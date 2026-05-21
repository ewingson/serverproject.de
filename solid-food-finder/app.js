// for Luke and comidas.gratis Solid Food Finder Application -->
// --- SECTION 1: CONFIGURATION ---
// oidc issuer will be prompted
let SOLID_OIDC_ISSUER = "";
// predicates
const FOAF_NAME_PREDICATE = "http://xmlns.com/foaf/0.1/name";
const VC_FN_PREDICATE = "http://www.w3.org/2006/vcard/ns#fn";
const PREF_PREDICATE = "http://www.w3.org/ns/pim/space#preferencesFile";
const PUB_TI_PREDICATE = "http://www.w3.org/ns/solid/terms#publicTypeIndex";
const PRIV_TI_PREDICATE = "http://www.w3.org/ns/solid/terms#privateTypeIndex";
const PIMSTORAGE_PREDICATE = "http://www.w3.org/ns/pim/space#storage";

// --- SECTION 2: UI ELEMENT REFERENCES ---
// --- I left vars from solid-info in the code, cause we need them anyway ---
const loadingDiv = document.getElementById('loading');
const guestDiv = document.getElementById('auth-guest');
const userDiv = document.getElementById('auth-user');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const usernameSpan = document.getElementById('username');
const webidSpan = document.getElementById('webid');
const fnSpan = document.getElementById('fn');
const prefSpan = document.getElementById('pref');
const pubindexSpan = document.getElementById('pubind');
const privindexSpan = document.getElementById('privind');
const latSpan = document.getElementById('lat');
const lonSpan = document.getElementById('lon');
const nowSpan = document.getElementById('nowdate');
const infoSpan = document.getElementById('sinfo');

// --- SECTION 3: CORE SOLID LOGIC ---

/**
 * Restores a previous session or handles the redirect from the login provider.
 * This is the main entry point of the application.
 */
async function main() {
    try {
        // Handle the redirect from the Solid Identity Provider.
        await solidClientAuthentication.handleIncomingRedirect({ restorePreviousSession: true });

        // Get the current session information.
        const session = solidClientAuthentication.getDefaultSession();
		
        // If not logged in, show the guest view and stop.
        if (!session.info.isLoggedIn) {
            updateUI(false);
            return;
        }

        // If logged in, fetch the user's info (webid) and update the UI.
        
        const webid = session.info.webId;
        // show webid in console
        console.log(webid);
        
        console.log("clientAppId: " + session.info.clientAppId);
        console.log("sessionId: " + session.info.sessionId);
        console.log("expirationDate: " + session.info.expirationDate);
        let timestamp = session.info.expirationDate;
        let sessiondateraw = new Date(timestamp);
        let nowdateraw = Date.now();
        let sessiondate = getfTimestamp(sessiondateraw);
        let nowdate = getfTimestamp(nowdateraw);
        console.log("expires: " + sessiondate);
        console.log("now: " + nowdate);
        nowSpan.textContent = nowdate;
        let info = (JSON.stringify(session,null,4));
        console.log(info);
        infoSpan.textContent = info;
        
        // function to update UI
        updateUI(true, webid);
        
        // just test/experiment: this navigator block works only in firefox, chromium needs an API-key
        const successCallback = (position) => {
  		console.log(position);
  		console.log(position.coords.latitude);
  		console.log(position.coords.longitude);
  		latSpan.textContent = position.coords.latitude;
  		lonSpan.textContent = position.coords.longitude;
		};
		const errorCallback = (error) => {
  		console.log(error);
		};
		navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
		
    } catch (error) {
        alert(error.message);
        updateUI(false); // If an error occurs, show the guest view.
    }
}

function getfTimestamp (udate) {
  const pad = (n,s=2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
  const d = new Date(udate);
  
  return `${pad(d.getFullYear(),4)}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getLoginUrl() {
    // Asking for a login url in Solid is kind of tricky. In a real application, you should be
    // asking for a user's webId, and reading the user's profile you would be able to obtain
    // the url of their identity provider. However, most users may not know what their webId is,
    // and they introduce the url of their issue provider directly. In order to simplify this
    // example, we just use the base domain of the url they introduced, and this should work
    // most of the time.
    const url = prompt('Introduce your Solid login url (this is your pod-provider or idp)');

    if (!url)
        return null;

    const loginUrl = new URL(url);
    loginUrl.hash = '';
    loginUrl.pathname = '';

    return loginUrl.href;
}

/**
 * A low-level helper to fetch and parse a Solid document.
 * @param {string} url - The URL of the document to read.
 * @returns {Promise<Array>} An array of quads from the parsed document.
 */
async function readSolidDocument(url) {
    // Use the authenticated fetch from the library.
    const response = await solidClientAuthentication.fetch(url, { headers: { Accept: 'text/turtle' } });
    if (Math.floor(response.status / 100) !== 2) return []; // Return empty on error.
    
    const data = await response.text();
    // The n3.min.js bundle exposes the Parser directly on the global N3 object.
    const parser = new N3.Parser({ baseIRI: url }); 

    return parser.parse(data);
}

// --- SECTION 4: UI AND EVENT HANDLING ---

/**
 * Updates the user interface based on the login state.
 * @param {boolean} isLoggedIn - Whether the user is logged in.
 * @param {string} [webidname] - The user's webid, if logged in.
 */
function updateUI(isLoggedIn, webidname) {
    loadingDiv.setAttribute('hidden', ''); // Hide loading message

    if (isLoggedIn) {
    	// hide
        guestDiv.setAttribute('hidden', '');
        userDiv.removeAttribute('hidden');
        // output
        webidSpan.textContent = webidname;
        
    } else {
        userDiv.setAttribute('hidden', '');
        guestDiv.removeAttribute('hidden');
    }
}

// Attach event listeners to buttons.
loginButton.onclick = () => {
	SOLID_OIDC_ISSUER = getLoginUrl();
    solidClientAuthentication.login({
        oidcIssuer: SOLID_OIDC_ISSUER, // user will provide this value per prompt
        redirectUrl: window.location.href,
        clientName: 'Solid Food Finder App'
    });
};

logoutButton.onclick = async () => {
    logoutButton.setAttribute('disabled', '');
    await solidClientAuthentication.logout();
    logoutButton.removeAttribute('disabled');
    updateUI(false); // Reset to guest view.
};

// fallback function (not yet used)
async function findUserStorage(url) {
    url = url.replace(/#.*$/, '');
    url = url.endsWith('/') ? url + '../' : url + '/../';
    url = new URL(url);

    const response = await solidClientAuthentication.fetch(url.href);

    if (response.headers.get('Link')?.includes('<http://www.w3.org/ns/pim/space#Storage>; rel="type"'))
        return url.href;

    if (url.pathname === '/')
        return url.href;

    return findUserStorage(url.href)
}

// --- SECTION 5: START THE APPLICATION ---
main();
