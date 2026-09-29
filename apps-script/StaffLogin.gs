/**
 * WSLR Quote Server: staff login (29 Sept 2026)
 *
 * Add this as a NEW file in the quote server's Apps Script project
 * (Files  +  Script, name it StaffLogin), then make the one change to doPost
 * described below and redeploy (Deploy > Manage deployments > edit > New version).
 *
 * What it does:
 *   - "login": checks a staff member's name and password, and if right, replies with
 *     the server's staff key. The quote tool keeps that key in the browser and uses it
 *     exactly as before, so nothing else in the server changes.
 *   - "changePassword": lets a signed in person change their own password.
 *
 * Everyone starts on the default password below. A changed password is stored only as
 * a salted SHA-256 hash in Script Properties (never in plain text), and it works on
 * every computer. After 5 wrong passwords in a row a name is locked for 15 minutes.
 *
 * THE ONE CHANGE TO doPost: make these two lines the very first lines inside doPost(e),
 * before anything that reads or checks the token:
 *
 *     var loginReply = staffLoginRoute_(e);
 *     if (loginReply) return loginReply;
 *
 * THE STAFF KEY: this file looks for the key the server already uses, in this order:
 *   1. Script Property STAFF_KEY  (Project Settings > Script Properties)
 *   2. Script Property STAFF_TOKEN
 *   3. Script Property TOKEN
 *   4. a global variable named STAFF_KEY or TOKEN in the other script files
 * If your key lives somewhere else, add a Script Property STAFF_KEY with the same value.
 *
 * To reset someone's password back to the default, run resetStaffPassword() from the
 * editor after typing their name into it, or delete their "login_pw_..." Script Property.
 */

var LOGIN_DEFAULT_PASSWORD = "QuoteWSLR!";
var LOGIN_MAX_TRIES = 5;
var LOGIN_LOCK_SECONDS = 15 * 60;

function staffLoginRoute_(e) {
  var data;
  try {
    data = JSON.parse(e && e.postData && e.postData.contents);
  } catch (err) {
    return null;
  }
  if (!data || (data.action !== "login" && data.action !== "changePassword")) return null;
  var reply;
  try {
    reply = data.action === "login" ? staffLogin_(data) : staffChangePassword_(data);
  } catch (err) {
    reply = { error: "The quote server had a problem: " + err };
  }
  return ContentService.createTextOutput(JSON.stringify(reply)).setMimeType(ContentService.MimeType.JSON);
}

function staffLogin_(data) {
  var user = loginCleanName_(data.user);
  if (!user) return { error: "Please choose or type your name." };
  var check = loginCheckPassword_(user, data.password);
  if (check) return check;
  var key = loginStaffKey_();
  if (!key) return { error: "The quote server has no staff key set. Ask Joel to add the STAFF_KEY Script Property." };
  return { ok: true, user: user, key: key };
}

function staffChangePassword_(data) {
  var user = loginCleanName_(data.user);
  if (!user) return { error: "Please sign in first." };
  var check = loginCheckPassword_(user, data.password);
  if (check) return check.error === "Wrong password. Please try again." ? { error: "Your current password is not right." } : check;
  var pw = String(data.newPassword || "");
  if (pw.length < 6) return { error: "The new password needs at least 6 characters." };
  if (pw.length > 100) return { error: "The new password is too long." };
  var salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(loginPropName_(user), salt + ":" + loginHash_(salt, pw));
  return { ok: true };
}

/* null when the password is right, otherwise {error} */
function loginCheckPassword_(user, password) {
  var cache = CacheService.getScriptCache();
  var tryKey = "login_tries_" + loginPropName_(user);
  var tries = Number(cache.get(tryKey) || 0);
  if (tries >= LOGIN_MAX_TRIES) return { error: "Too many wrong passwords for " + user + ". Please wait 15 minutes and try again." };
  var pw = String(password || "");
  var stored = PropertiesService.getScriptProperties().getProperty(loginPropName_(user));
  var good;
  if (stored) {
    var parts = stored.split(":");
    good = parts.length === 2 && loginHash_(parts[0], pw) === parts[1];
  } else {
    good = pw === LOGIN_DEFAULT_PASSWORD;
  }
  if (!good) {
    cache.put(tryKey, String(tries + 1), LOGIN_LOCK_SECONDS);
    return { error: "Wrong password. Please try again." };
  }
  cache.remove(tryKey);
  return null;
}

function loginStaffKey_() {
  var props = PropertiesService.getScriptProperties();
  var names = ["STAFF_KEY", "STAFF_TOKEN", "TOKEN"];
  for (var i = 0; i < names.length; i++) {
    var v = props.getProperty(names[i]);
    if (v) return v;
  }
  if (typeof STAFF_KEY !== "undefined" && STAFF_KEY) return String(STAFF_KEY);
  if (typeof TOKEN !== "undefined" && TOKEN) return String(TOKEN);
  return "";
}

function loginCleanName_(name) {
  var n = String(name || "").replace(/\s+/g, " ").trim();
  return n.length >= 1 && n.length <= 40 ? n : "";
}

function loginPropName_(user) {
  return "login_pw_" + String(user).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function loginHash_(salt, pw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "|" + pw, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

/* run from the editor: type the name between the quotes first */
function resetStaffPassword() {
  var user = "";
  if (!user) throw new Error("Type the person's name into resetStaffPassword() first.");
  PropertiesService.getScriptProperties().deleteProperty(loginPropName_(user));
  CacheService.getScriptCache().remove("login_tries_" + loginPropName_(user));
}
