import { ProxyHandler } from '../utils/proxy.js';
import { GPXEngine } from '../utils/gpx-engine.js';

export class KomootPlatform {
    static IDENTIFIERS = ['komoot.com'];

    static isMatch(url) {
        return this.IDENTIFIERS.some(id => url.includes(id));
    }

    static async extract(url) {
        const id = this.extractId(url);
        const type = this.detectType(url);

        if (!id) throw new Error("Impossible d'extraire l'ID Komoot de l'URL.");

        if (type === 'collection') {
            return await this.fetchCollection(id);
        } else if (type === 'tour' || type === 'smarttour') {
            return await this.fetchTour(id);
        } else if (type === 'discover') {
            // Pour Discover, c'est plus complexe car l'URL contient des coordonnées
            // On va essayer d'extraire les paramètres de recherche
            return await this.fetchDiscover(url);
        } else {
            throw new Error(`Type d'URL Komoot non supporté : ${type}`);
        }
    }

    static extractId(url) {
        // Ex: https://www.komoot.com/fr-fr/collection/2439186
        // Ex: https://www.komoot.com/fr-fr/tour/1358031441
        const matches = url.match(/\/(collection|tour|smarttour)\/([a-zA-Z0-9]+)/);
        return matches ? matches[2] : null;
    }

    static detectType(url) {
        if (url.includes('/collection/')) return 'collection';
        if (url.includes('/tour/')) return 'tour';
        if (url.includes('/smarttour/')) return 'smarttour';
        if (url.includes('/discover/')) return 'discover';
        return null;
    }

    static async fetchCollection(id) {
        const apiUrl = `https://www.komoot.com/api/v007/collections/${id}/compilation_lines_extended/`;
        const data = await ProxyHandler.fetch(apiUrl);
        
        if (!data || !data._embedded || !data._embedded.items) {
            throw new Error("Format de réponse Collection invalide.");
        }

        return data._embedded.items.map(item => ({
            id: item.id,
            name: item.name,
            provider: 'Parcours',
            distance: (item.distance / 1000).toFixed(2) + ' km',
            elevation: item.elevation_up + ' m',
            sport: item.sport,
            points: item.geometry // Le tableau de points [lat, lng, alt]
        }));
    }

    static async fetchTour(id) {
        const apiUrl = `https://www.komoot.com/api/v007/tours/${id}?_embedded=coordinates`;
        const data = await ProxyHandler.fetch(apiUrl);

        if (!data) throw new Error("Impossible de récupérer les données du tour.");

        return [{
            id: data.id,
            name: data.name,
            provider: 'Parcours',
            distance: (data.distance / 1000).toFixed(2) + ' km',
            elevation: data.elevation_up + ' m',
            sport: data.sport,
            points: data._embedded.coordinates.items
        }];
    }

    static async fetchDiscover(url) {
        // Transformation de l'URL Discover en appel API
        // On récupère les paramètres lat, lng, radius depuis l'URL si possible
        const urlObj = new URL(url);
        const geoMatch = urlObj.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        
        if (!geoMatch) throw new Error("Coordonnées non trouvées dans l'URL Discover.");
        
        const lat = geoMatch[1];
        const lng = geoMatch[2];
        const params = new URLSearchParams(urlObj.search);
        const sport = params.get('sport') || 'hike';
        const maxDist = params.get('max_distance') || '20000';

        const apiUrl = `https://www.komoot.com/api/v007/discover_tours/?lat=${lat}&lng=${lng}&max_distance=${maxDist}&_embedded=tour_line&sport=${sport}&limit=20`;
        const data = await ProxyHandler.fetch(apiUrl);

        if (!data || !data._embedded || !data._embedded.tours) {
            throw new Error("Aucun tour trouvé dans cette zone.");
        }

        return data._embedded.tours.map(t => ({
            id: t.id,
            name: t.name,
            provider: 'Parcours',
            distance: (t.distance / 1000).toFixed(2) + ' km',
            elevation: t.elevation_up + ' m',
            sport: t.sport,
            points: t._embedded.tour_line // Points simplifiés
        }));
    }

    static generateGPX(tour, highPrecision = false) {
        // Si c'est déjà des points formatés {lat, lng, alt}
        let points = tour.points;
        
        // Si c'est du format Komoot brut [ {lat, lng, alt}, ... ] ou [ [lat, lng, alt], ... ]
        // L'API compilation_lines_extended renvoie [ {lat, lng, alt}, ... ]
        // L'API discover renvoie [ {lat, lng, alt}, ... ]
        
        return GPXEngine.generate(tour.name, points);
    }
}
