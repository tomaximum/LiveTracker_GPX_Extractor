import { ProxyHandler } from '../utils/proxy.js';
import { GPXEngine } from '../utils/gpx-engine.js';

export class OwakaPlatform {
    static IDENTIFIERS = ['owaka.live'];
    static API_BASE = 'https://api.owaka.live';

    static isMatch(url) {
        return this.IDENTIFIERS.some(id => url.includes(id));
    }

    static async extract(url) {
        // Normaliser l'URL (enlever le trailing slash et gérer le protocole manquant)
        let normalized = url.replace(/\/$/, "");
        if (!normalized.startsWith('http')) normalized = 'https://' + normalized;
        
        const urlObj = new URL(normalized);
        const path = urlObj.pathname.toLowerCase();

        // Détecter si on veut la liste globale
        // Chemins autorisés pour le listing : vide, /, /events, /lives
        if (path === "" || path === "/" || path === "/events" || path === "/lives") {
            return await this.fetchLives();
        }

        // Sinon c'est un slug d'événement (ex: /raid-bulles-2024)
        const slug = this.extractSlug(normalized);
        if (!slug) throw new Error("Slug Owaka non trouvé dans l'URL.");

        return await this.fetchEventBySlug(slug);
    }

    static extractSlug(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            return urlObj.pathname.split('/').filter(p => p).pop();
        } catch (e) {
            return null;
        }
    }

    static async fetchLives() {
        const data = await ProxyHandler.fetch(`${this.API_BASE}/lives`);
        
        return data.map(item => ({
            id: item.id,
            name: item.name,
            provider: 'owaka',
            slug: item.slug,
            date: new Date(item.startedAt).toLocaleDateString(),
            type: 'event_list'
        }));
    }

    static async fetchEventBySlug(slug) {
        // On récupère d'abord l'ID via la liste des lives (ou un endpoint direct si existant)
        const lives = await ProxyHandler.fetch(`${this.API_BASE}/lives`);
        const event = lives.find(l => l.slug === slug);

        if (!event) throw new Error(`Événement "${slug}" introuvable.`);

        // Pour Owaka, un événement peut avoir plusieurs véhicules avec chacun sa trace
        // Ou des étapes (stages) avec des traces prévues
        const vehicles = await ProxyHandler.fetch(`${this.API_BASE}/lives/${event.id}/vehicles`);
        
        return vehicles.map(v => ({
            id: v.id,
            name: `${v.number} - ${v.name}`,
            provider: 'owaka',
            category: v.category,
            eventId: event.id,
            type: 'vehicle_trace'
        }));
    }

    /**
     * Pour Owaka, on doit souvent fetcher les positions chronologiquement pour un véhicule
     */
    static async fetchVehiclePoints(eventId, vehicleId) {
        // En mode LiveTracker V1, on utilisait souvent les dernières locations sur une large plage
        // Simulation d'une plage de 48h
        const now = new Date();
        const start = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
        const end = now.toISOString();

        const apiUrl = `${this.API_BASE}/lives/${eventId}/latest_locations?vehicleId=${vehicleId}&startedAt=${start}&endedAt=${end}`;
        const data = await ProxyHandler.fetch(apiUrl);

        // Owaka renvoie un objet avec les positions par véhicule
        const positions = data[vehicleId] || [];
        return positions.map(p => ({
            lat: p.latitude,
            lng: p.longitude,
            alt: p.altitude || 0,
            t: p.recordedAt
        }));
    }

    static async downloadGPX(item) {
        if (item.type === 'vehicle_trace') {
            const points = await this.fetchVehiclePoints(item.eventId, item.id);
            if (points.length === 0) throw new Error("Aucun point trouvé pour ce participant.");
            const gpx = GPXEngine.generate(item.name, points);
            GPXEngine.download(item.name, gpx);
        }
    }
}
