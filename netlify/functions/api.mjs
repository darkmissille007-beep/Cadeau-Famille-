// Serveur du site : connexion par code personnel + données partagées dans Netlify Blobs.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const MODE = "cadeaux"; // "cadeaux" ou "courses"
export const config = { path: "/api/*" };

const CATS = ["Repas", "Petit-déjeuner", "Apéro", "Boissons", "Hygiène & soins", "Matériel ski", "Divers"];
const MAX_TRIES = 5, LOCK_MS = 10 * 60 * 1000, TOKEN_MS = 180 * 24 * 3600 * 1000;

const store = () => getStore({ name: "famille-" + MODE, consistency: "strong" });
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (m, s = 400) => json({ error: m }, s);
const newId = () => crypto.randomBytes(8).toString("hex");
const str = (v, max) => String(v ?? "").trim().slice(0, max);

async function secret(st) {
  let s = await st.get("meta/secret");
  if (!s) { s = crypto.randomBytes(32).toString("hex"); await st.set("meta/secret", s); }
  return s;
}
function hashCode(code) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(code), salt, 32).toString("hex");
}
function checkCode(code, stored) {
  const [salt, h] = String(stored || "").split(":");
  if (!salt || !h) return false;
  const a = Buffer.from(h, "hex"), b = crypto.scryptSync(String(code), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const mac = (payload, sec) => crypto.createHmac("sha256", sec).update(payload).digest("hex");
function sign(p, sec) { const payload = p.id + "." + (p.ver || 0) + "." + (Date.now() + TOKEN_MS); return payload + "." + mac(payload, sec); }
function readToken(tok, sec) {
  const parts = String(tok || "").split(".");
  if (parts.length !== 4) return null;
  const [id, ver, exp, m] = parts;
  if (+exp < Date.now()) return null;
  const good = mac(id + "." + ver + "." + exp, sec);
  if (good.length !== m.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(m))) return null;
  return { id, ver: +ver };
}
async function list(st, prefix) {
  const { blobs } = await st.list({ prefix });
  const out = await Promise.all(blobs.map(b => st.get(b.key, { type: "json" })));
  return out.filter(Boolean).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
const publicPerson = p => ({ id: p.id, name: p.name, isAdmin: !!p.isAdmin, hasCode: !!p.codeHash });
// "Lardons", "lardon ", "LARDON" → même article
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").map(w => w.length > 3 ? w.replace(/[sx]$/, "") : w).join(" ");
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
const frDate = s => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(s + "T00:00:00Z"));
const OCCASIONS = ["noel", "anniv", "meres", "peres"]; // "" = valable pour toutes les occasions
// Anniversaire au format "MM-JJ" (sans année) ; le 29 février est accepté.
const isBirthday = s => { const m = /^(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return false; const mo = +m[1], d = +m[2]; return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(2000, mo, 0)).getUTCDate(); };
// Dates connues de la famille (jour et mois). Utilisées tant que la personne n'a pas choisi sa date elle-même.
const DEFAULT_BDAYS = { "zoé": "10-28", "ethen": "11-01", "jade": "01-21", "vincent": "03-18", "chiara": "05-24", "laurence": "08-29", "paul": "09-22" };
const bdayOf = p => p.birthday !== undefined ? p.birthday : (DEFAULT_BDAYS[String(p.name).trim().toLowerCase().normalize("NFC")] || null);
// Parents de la famille : seuls eux sont concernés par la fête des mères / des pères. L'organisateur peut changer ce rôle.
const DEFAULT_PARENTS = { "laurence": "meres", "vincent": "peres" };
const PARENTS = ["meres", "peres"];
const key = name => String(name).trim().toLowerCase().normalize("NFC");
const parentOf = p => p.parent !== undefined ? p.parent : (DEFAULT_PARENTS[key(p.name)] || null);
const validCode = c => typeof c === "string" && /^[0-9]{4,12}$/.test(c.trim());

async function stateFor(st, me, people) {
  // Les dates d'anniversaire ne sont visibles qu'une fois connecté.
  const withBday = p => me ? { ...publicPerson(p), birthday: bdayOf(p), parent: parentOf(p) } : publicPerson(p);
  const out = { me: me ? withBday(me) : null, people: people.map(withBday), needsSetup: people.length === 0 };
  if (!me) return out;
  if (MODE === "cadeaux") {
    const gifts = await list(st, "gift/");
    out.gifts = []; out.hidden = 0;
    for (const g of gifts) {
      if (g.for === me.id && g.addedBy !== me.id) { out.hidden++; continue; } // la surprise reste cachée, même dans les données
      out.gifts.push(g.for === me.id ? { ...g, reservedBy: null } : g);
    }
    // Suggestions anonymes : la personne visée les voit sans l'auteur ; l'auteur voit seulement les siennes en attente.
    const sugg = await list(st, "sugg/");
    out.suggestions = sugg.filter(x => x.for === me.id).map(({ from, ...x }) => x);
    out.sent = sugg.filter(x => x.from === me.id && x.for !== me.id);
  } else {
    out.courses = await list(st, "course/");
    out.stays = (await list(st, "stay/")).sort((a, b) => a.start < b.start ? -1 : 1);
  }
  return out;
}

export default async (req) => {
  const st = store();
  const sec = await secret(st);
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const people = await list(st, "person/");
  const byId = Object.fromEntries(people.map(p => [p.id, p]));
  const tok = readToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), sec);
  const me = tok && byId[tok.id] && (byId[tok.id].ver || 0) === tok.ver ? byId[tok.id] : null;
  let body = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { return fail("Requête illisible."); } }

  if (route === "state" && req.method === "GET") return json(await stateFor(st, me, people));

  if (route === "setup" && req.method === "POST") {
    if (people.length) return fail("Le site est déjà configuré.", 409);
    // La première ligne est l'organisateur ; un code vide = accès à donner plus tard.
    const rows = Array.isArray(body.people) ? body.people.slice(0, 30) : [];
    if (!rows.length) return fail("Ajoutez au moins une personne.");
    const seen = new Set(), made = [];
    for (const [i, r] of rows.entries()) {
      const name = str(r && r.name, 40), code = str(r && r.code, 64);
      if (!name) return fail("Un prénom est vide (ligne " + (i + 1) + ").");
      if (seen.has(name.toLowerCase())) return fail(name + " apparaît deux fois.");
      seen.add(name.toLowerCase());
      if (i === 0 && !validCode(code)) return fail("Votre code d'organisateur doit faire 4 à 12 chiffres.");
      if (code && !validCode(code)) return fail("Le code de " + name + " doit faire 4 à 12 chiffres.");
      made.push({ id: newId(), name, isAdmin: i === 0, codeHash: code ? hashCode(code) : null, ver: 0, createdAt: Date.now() + i, birthday: DEFAULT_BDAYS[key(name)] || null, parent: DEFAULT_PARENTS[key(name)] || null });
    }
    for (const p of made) await st.setJSON("person/" + p.id, p);
    return json({ token: sign(made[0], sec) });
  }

  if (route === "login" && req.method === "POST") {
    const p = byId[str(body.personId, 40)];
    if (!p) return fail("Prénom inconnu.", 404);
    const triesKey = "meta/tries/" + p.id;
    const tries = (await st.get(triesKey, { type: "json" })) || { n: 0, until: 0 };
    if (!p.codeHash) return fail(p.name + " n'a pas encore de code : demandez-le à l'organisateur.", 403);
    if (tries.until > Date.now()) return fail("Trop d'essais. Réessayez dans " + Math.ceil((tries.until - Date.now()) / 60000) + " min.", 429);
    if (!checkCode(str(body.code, 64), p.codeHash)) {
      tries.n++; if (tries.n >= MAX_TRIES) { tries.n = 0; tries.until = Date.now() + LOCK_MS; }
      await st.setJSON(triesKey, tries);
      return fail("Code incorrect.", 401);
    }
    await st.delete(triesKey);
    return json({ token: sign(p, sec) });
  }

  if (route !== "action" || req.method !== "POST") return fail("Introuvable.", 404);
  if (!me) return fail("Session expirée : reconnectez-vous.", 401);
  const t = body.type;

  // --- Famille (commun aux deux sites) ---
  if (t === "addPerson") {
    if (!me.isAdmin) return fail("Seul l'organisateur peut ajouter quelqu'un.", 403);
    const name = str(body.name, 40);
    if (!name) return fail("Indiquez un prénom.");
    if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) return fail(name + " est déjà dans la liste.", 409);
    if (!validCode(body.code)) return fail("Le code doit faire 4 à 12 chiffres.");
    const p = { id: newId(), name, isAdmin: false, codeHash: hashCode(body.code.trim()), ver: 0, createdAt: Date.now() };
    await st.setJSON("person/" + p.id, p);
    return json({ ok: true });
  }
  if (t === "setCode") {
    const p = byId[str(body.id, 40)];
    if (!p) return fail("Personne introuvable.", 404);
    if (p.id !== me.id && !me.isAdmin) return fail("Vous ne pouvez changer que votre propre code.", 403);
    if (!validCode(body.code)) return fail("Le code doit faire 4 à 12 chiffres.");
    const upd = { ...p, codeHash: hashCode(body.code.trim()), ver: (p.ver || 0) + 1 };
    await st.setJSON("person/" + p.id, upd);
    return json({ ok: true, token: p.id === me.id ? sign(upd, sec) : undefined });
  }
  if (t === "setBirthday") {
    const p = byId[str(body.id, 40)];
    if (!p) return fail("Personne introuvable.", 404);
    if (p.id !== me.id && !me.isAdmin) return fail("Vous ne pouvez changer que votre propre date.", 403);
    const b = str(body.birthday, 5);
    if (b && !isBirthday(b)) return fail("Date d'anniversaire invalide.");
    await st.setJSON("person/" + p.id, { ...p, birthday: b || null });
    return json({ ok: true });
  }
  if (t === "setParent") {
    if (!me.isAdmin) return fail("Seul l'organisateur peut changer ce réglage.", 403);
    const p = byId[str(body.id, 40)];
    if (!p) return fail("Personne introuvable.", 404);
    const v = PARENTS.includes(body.parent) ? body.parent : null;
    await st.setJSON("person/" + p.id, { ...p, parent: v });
    return json({ ok: true });
  }
  if (t === "removePerson") {
    if (!me.isAdmin) return fail("Seul l'organisateur peut retirer quelqu'un.", 403);
    if (body.id === me.id) return fail("Vous ne pouvez pas vous retirer vous-même.");
    if (!byId[body.id]) return fail("Personne introuvable.", 404);
    await st.delete("person/" + body.id);
    if (MODE === "cadeaux") for (const x of await list(st, "sugg/")) if (x.for === body.id || x.from === body.id) await st.delete("sugg/" + x.id);
    return json({ ok: true });
  }

  if (MODE === "cadeaux") {
    const getGift = async id => (await st.get("gift/" + str(id, 40), { type: "json" }));
    // Champs communs à une idée et à une suggestion ; renvoie un message d'erreur ou les champs propres.
    const ideaFields = (forId, b) => {
      const title = str(b.title, 120);
      if (!title) return "Indiquez une idée.";
      if (PARENTS.includes(b.occasion) && parentOf(byId[forId]) !== b.occasion)
        return (b.occasion === "meres" ? "La fête des mères" : "La fête des pères") + " ne concerne pas " + byId[forId].name + ".";
      const link = str(b.link, 500), price = parseFloat(String(b.price ?? "").replace(",", "."));
      return { title, link: /^https?:\/\//i.test(link) ? link : "", price: isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null, note: str(b.note, 300), occasion: OCCASIONS.includes(b.occasion) ? b.occasion : "" };
    };
    if (t === "addGift") {
      // Chacun ne remplit que sa propre liste ; pour les autres, on passe par une suggestion anonyme.
      if (body.for !== me.id) return fail("Vous ne pouvez ajouter des idées que sur votre propre liste. Envoyez plutôt une suggestion anonyme.", 403);
      const f = ideaFields(me.id, body);
      if (typeof f === "string") return fail(f);
      await st.setJSON("gift/" + (f.id = newId()), { ...f, for: me.id, addedBy: me.id, reservedBy: null, createdAt: Date.now() });
      return json({ ok: true });
    }
    if (t === "suggest") {
      const to = byId[str(body.for, 40)];
      if (!to) return fail("Personne introuvable.", 404);
      if (to.id === me.id) return fail("Ajoutez plutôt l'idée directement à votre liste.");
      const f = ideaFields(to.id, body);
      if (typeof f === "string") return fail(f);
      const pending = (await list(st, "sugg/")).filter(x => x.from === me.id && x.for === to.id);
      if (pending.length >= 10) return fail("Vous avez déjà 10 suggestions en attente pour " + to.name + ".", 429);
      const id = newId();
      await st.setJSON("sugg/" + id, { ...f, id, for: to.id, from: me.id, createdAt: Date.now() });
      return json({ ok: true });
    }
    if (t === "acceptSuggestion" || t === "declineSuggestion" || t === "withdrawSuggestion") {
      const x = await st.get("sugg/" + str(body.id, 40), { type: "json" });
      if (!x) return fail("Cette suggestion n'existe plus.", 404);
      if (t === "withdrawSuggestion" ? x.from !== me.id : x.for !== me.id) return fail("Cette suggestion n'existe plus.", 404);
      if (t === "acceptSuggestion") {
        const { from, ...f } = x;
        await st.setJSON("gift/" + (f.id = newId()), { ...f, for: me.id, addedBy: me.id, fromSuggestion: true, reservedBy: null, createdAt: Date.now() });
      }
      await st.delete("sugg/" + x.id);
      return json({ ok: true });
    }
    const g = await getGift(body.id);
    if (!g) return fail("Cette idée n'existe plus.", 404);
    if (g.for === me.id && g.addedBy !== me.id) return fail("Cette idée n'existe plus.", 404);
    if (t === "reserve") {
      if (g.for === me.id) return fail("Vous ne pouvez pas vous offrir votre propre cadeau ici.");
      if (g.reservedBy && g.reservedBy !== me.id) return fail("Quelqu'un l'offre déjà.", 409);
      await st.setJSON("gift/" + g.id, { ...g, reservedBy: me.id });
      return json({ ok: true });
    }
    if (t === "unreserve") {
      if (g.reservedBy !== me.id && !me.isAdmin) return fail("Seule la personne qui l'offre peut annuler.", 403);
      await st.setJSON("gift/" + g.id, { ...g, reservedBy: null });
      return json({ ok: true });
    }
    if (t === "deleteGift") {
      if (g.addedBy !== me.id && !me.isAdmin) return fail("Seule la personne qui a proposé l'idée peut la supprimer.", 403);
      await st.delete("gift/" + g.id);
      return json({ ok: true });
    }
  } else {
    const okBringer = b => !b || !!byId[b];
    if (t === "addCourse") {
      const label = str(body.label, 80);
      if (!label) return fail("Indiquez un article.");
      if (!okBringer(body.bringer)) return fail("Personne introuvable.", 404);
      const dup = (await list(st, "course/")).find(x => norm(x.label) === norm(label));
      if (dup) return json({ error: "« " + dup.label + " » est déjà sur la liste" + (dup.done ? " (déjà pris)" : "") + ". Changez plutôt sa quantité.", dupId: dup.id }, 409);
      const c = { id: newId(), label, qty: str(body.qty, 20), category: CATS.includes(body.category) ? body.category : "Divers", bringer: body.bringer || null, done: false, addedBy: me.id, createdAt: Date.now() };
      await st.setJSON("course/" + c.id, c);
      return json({ ok: true });
    }
    // --- Calendrier de l'appartement : un séjour occupe les nuits de l'arrivée (incluse) au départ (exclu) ---
    if (t === "addStay") {
      const start = str(body.start, 10), end = str(body.end, 10);
      if (!isDate(start) || !isDate(end)) return fail("Indiquez une date d'arrivée et une date de départ.");
      const n = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 864e5;
      if (n < 1) return fail("Le départ doit être au moins le lendemain de l'arrivée.");
      if (n > 90) return fail("Un séjour ne peut pas dépasser 90 nuits.");
      const who = body.who || me.id;
      if (!byId[who]) return fail("Personne introuvable.", 404);
      const clash = (await list(st, "stay/")).find(s => start < s.end && s.start < end);
      if (clash) return fail("L'appartement est déjà occupé par " + (byId[clash.who]?.name || "quelqu'un") + " du " + frDate(clash.start) + " au " + frDate(clash.end) + ".", 409);
      const s = { id: newId(), start, end, who, note: str(body.note, 140), addedBy: me.id, createdAt: Date.now() };
      await st.setJSON("stay/" + s.id, s);
      return json({ ok: true });
    }
    if (t === "deleteStay") {
      const s = await st.get("stay/" + str(body.id, 40), { type: "json" });
      if (!s) return fail("Ce séjour n'existe plus.", 404);
      if (s.addedBy !== me.id && s.who !== me.id && !me.isAdmin) return fail("Seule la personne concernée ou l'organisateur peut annuler ce séjour.", 403);
      await st.delete("stay/" + s.id);
      return json({ ok: true });
    }
    const c = await st.get("course/" + str(body.id, 40), { type: "json" });
    if (!c) return fail("Cet article n'existe plus.", 404);
    if (t === "updateCourse") {
      const upd = { ...c };
      if ("done" in body) upd.done = !!body.done;
      if ("qty" in body) upd.qty = str(body.qty, 20);
      if ("bringer" in body) { if (!okBringer(body.bringer)) return fail("Personne introuvable.", 404); upd.bringer = body.bringer || null; }
      await st.setJSON("course/" + c.id, upd);
      return json({ ok: true });
    }
    if (t === "deleteCourse") { await st.delete("course/" + c.id); return json({ ok: true }); }
  }
  return fail("Action inconnue.");
};
