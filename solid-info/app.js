// base code Noel and Gemini -->
// --- SECTION 1: CONFIGURATION ---
// oidc issuer will be prompted
let SOLID_OIDC_ISSUER = "";
const FOAF_NAME_PREDICATE = "http://xmlns.com/foaf/0.1/name";
const VC_FN_PREDICATE = "http://www.w3.org/2006/vcard/ns#fn";
const PREF_PREDICATE = "http://www.w3.org/ns/pim/space#preferencesFile";
const PUB_TI_PREDICATE = "http://www.w3.org/ns/solid/terms#publicTypeIndex";
const PRIV_TI_PREDICATE = "http://www.w3.org/ns/solid/terms#privateTypeIndex";
const PIMSTORAGE_PREDICATE = "http://www.w3.org/ns/pim/space#storage";

// --- SECTION 2: UI ELEMENT REFERENCES ---
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
const storageSpan = document.getElementById('root');

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

        // If logged in, fetch the user's info and update the UI.
        const user = await fetchUserProfile(session.info.webId);
        const webid = session.info.webId;
        const fname = await secondFetch(session.info.webId);
        // show fn in console
        console.log(fname);
        const preferences = await preferencesFetch(session.info.webId);
        const pubti = await pubIFetch(session.info.webId);
        const privti = await privIFetch(session.info.webId);
        const pims = await rootstorageFetch(session.info.webId);
	// function to update UI
        updateUI(true, user.name, webid, fname, preferences, pubti, privti, pims);

    } catch (error) {
        alert(error.message);
        updateUI(false); // If an error occurs, show the guest view.
    }
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
 * Fetches the user's name from their Solid profile.
 * @param {string} webId - The WebID of the user.
 * @returns {Promise<object>} An object containing the user's name.
 */
async function fetchUserProfile(webId) {
    // This function uses the `readSolidDocument` helper below.
    const profileQuads = await readSolidDocument(webId);

    // Find the quad containing the foaf:name.
    const nameQuad = profileQuads.find(quad => quad.predicate.value === FOAF_NAME_PREDICATE);

    return {
        name: nameQuad?.object.value || 'Anonymous'
    };
}

async function secondFetch(webId) {
    // This function uses the `readSolidDocument` helper below.
    const profileQuads = await readSolidDocument(webId);

	const fnQuad = profileQuads.find(quad => quad.predicate.value === VC_FN_PREDICATE);

    // It returns the found vcard:fn value, or a default string if not found.
    return fnQuad?.object.value || 'hmm, not set';
}

async function preferencesFetch(webId) {
    // This function uses the `readSolidDocument` helper below.
    const profileQuads = await readSolidDocument(webId);

	const prefQuad = profileQuads.find(quad => quad.predicate.value === PREF_PREDICATE);

    // It returns the found preferences value, or a default string if not found.
    return prefQuad?.object.value || 'hmm, not found';
}

async function pubIFetch(webId) {
    // This function uses the `readSolidDocument` helper below.
    const profileQuads = await readSolidDocument(webId);

	const pubiQuad = profileQuads.find(quad => quad.predicate.value === PUB_TI_PREDICATE);

    // It returns the found publicTypeIndex value, or a default string if not found.
    return pubiQuad?.object.value || 'hmm, not found';
}

async function privIFetch(webId) {
    // This function uses the `readSolidDocument` helper below.
    const profileQuads = await readSolidDocument(webId);

	const priviQuad = profileQuads.find(quad => quad.predicate.value === PRIV_TI_PREDICATE);

    // It returns the found privateTypeIndex value, or a default string if not found.
    return priviQuad?.object.value || 'hmm, not found';
}

// find root storage location / equivalent to the fetches above
async function rootstorageFetch(webId) {
    const profileQuads = await readSolidDocument(webId);
    
    const storageQuad = profileQuads.find(quad => quad.predicate.value === PIMSTORAGE_PREDICATE);

    return storageQuad?.object.value || await findUserStorage(webId);
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
 * @param {string} [name] - The user's name, if logged in.
 */
function updateUI(isLoggedIn, name, webidname, fName, preF, pubTI, privTI, pimS) {
    loadingDiv.setAttribute('hidden', ''); // Hide loading message

    if (isLoggedIn) {
    	// hide
        guestDiv.setAttribute('hidden', '');
        userDiv.removeAttribute('hidden');
        // output
        usernameSpan.textContent = name;
        webidSpan.textContent = webidname;
        fnSpan.textContent = fName;
        prefSpan.textContent = preF;
        pubindexSpan.textContent = pubTI;
        privindexSpan.textContent = privTI;
        storageSpan.textContent = pimS;
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
        clientName: 'Solid Info App'
    });
};

logoutButton.onclick = async () => {
    logoutButton.setAttribute('disabled', '');
    await solidClientAuthentication.logout();
    logoutButton.removeAttribute('disabled');
    updateUI(false); // Reset to guest view.
};

// fallback function
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
