/**
 * Gère les requêtes via des Proxies CORS pour éviter les blocages navigateurs
 */
export class ProxyHandler {
    static proxies = [
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url) => `https://cors-anywhere.herokuapp.com/${url}`, // Nécessite souvent une activation manuelle
        (url) => `https://corsproxy.org/?${encodeURIComponent(url)}`
    ];

    static async fetch(url, options = {}) {
        let lastError = null;
        
        // On essaie les proxies l'un après l'autre
        for (const proxyFn of this.proxies) {
            try {
                const proxyUrl = proxyFn(url);
                const response = await fetch(proxyUrl, options);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.json();
            } catch (e) {
                console.warn(`Proxy failed: ${e.message}`);
                lastError = e;
                continue;
            }
        }
        
        throw new Error(`Tous les proxies ont échoué. ${lastError?.message}`);
    }

    static async fetchText(url) {
        for (const proxyFn of this.proxies) {
            try {
                const proxyUrl = proxyFn(url);
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return await response.text();
            } catch (e) {
                continue;
            }
        }
        throw new Error("Échec du téléchargement du texte via proxy.");
    }
}
