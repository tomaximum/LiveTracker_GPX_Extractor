import { KomootPlatform } from './platforms/komoot.js';
import { OwakaPlatform } from './platforms/owaka.js';
import { ProxyHandler } from './utils/proxy.js';
import { GPXEngine } from './utils/gpx-engine.js';

class App {
    constructor() {
        this.urlInput = document.getElementById('url-input');
        this.extractBtn = document.getElementById('extract-btn');
        this.btnLoader = document.getElementById('btn-loader');
        this.resultsArea = document.getElementById('results-area');
        this.tourList = document.getElementById('tour-list');
        this.errorMsg = document.getElementById('error-message');
        this.downloadAllBtn = document.getElementById('download-all-btn');

        this.currentTours = [];
        this.init();
    }

    init() {
        this.extractBtn.addEventListener('click', () => this.handleExtract());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleExtract();
        });
        this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
    }

    async handleExtract() {
        const url = this.urlInput.value.trim();
        if (!url) return;

        this.setLoading(true);
        this.hideError();
        this.tourList.innerHTML = '';
        this.resultsArea.style.display = 'none';

        try {
            let platform = null;
            if (KomootPlatform.isMatch(url)) platform = KomootPlatform;
            else if (OwakaPlatform.isMatch(url)) platform = OwakaPlatform;

            if (!platform) {
                throw new Error("Plateforme non reconnue. Seuls Komoot et Owaka sont supportés pour le moment.");
            }

            const results = await platform.extract(url);
            this.currentTours = results;
            this.renderResults(results);
            this.resultsArea.style.display = 'block';
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    renderResults(results) {
        const platform = results[0]?.provider;
        document.getElementById('results-title').textContent = `${results.length} résultat(s) ${platform} trouvé(s)`;

        results.forEach((tour, index) => {
            const item = document.createElement('div');
            item.className = 'tour-item';
            
            const info = document.createElement('div');
            info.className = 'tour-info';
            info.innerHTML = `
                <h4>${tour.name}</h4>
                <div class="tour-meta">
                    ${tour.distance ? tour.distance : ''} ${tour.elevation ? ' • ' + tour.elevation : ''} 
                    ${tour.sport ? ' • ' + tour.sport : ''}
                    ${tour.date ? ' • ' + tour.date : ''}
                </div>
            `;

            const actions = document.createElement('div');
            actions.className = 'tour-actions';
            
            const dlBtn = document.createElement('button');
            dlBtn.className = 'primary';
            dlBtn.style.padding = '8px 15px';
            dlBtn.style.fontSize = '0.85rem';
            dlBtn.innerHTML = 'GPX';
            dlBtn.addEventListener('click', () => this.downloadSingle(tour));

            actions.appendChild(dlBtn);
            item.appendChild(info);
            item.appendChild(actions);
            this.tourList.appendChild(item);
        });
    }

    async downloadSingle(tour) {
        try {
            if (tour.provider === 'komoot') {
                const gpx = KomootPlatform.generateGPX(tour);
                GPXEngine.download(tour.name, gpx);
            } else if (tour.provider === 'owaka') {
                await OwakaPlatform.downloadGPX(tour);
            }
        } catch (err) {
            this.showError(`Échec du téléchargement : ${err.message}`);
        }
    }

    async downloadAll() {
        if (!this.currentTours.length) return;
        
        const zip = new JSZip();
        this.setLoading(true);

        try {
            for (const tour of this.currentTours) {
                let gpxContent = '';
                if (tour.provider === 'komoot') {
                    gpxContent = KomootPlatform.generateGPX(tour);
                } else if (tour.provider === 'owaka') {
                    if (tour.type === 'vehicle_trace') {
                        const points = await OwakaPlatform.fetchVehiclePoints(tour.eventId, tour.id);
                        gpxContent = GPXEngine.generate(tour.name, points);
                    }
                }

                if (gpxContent) {
                    zip.file(`${tour.name.replace(/[/\\?%*:|"<>]/g, '-')}.gpx`, gpxContent);
                }
            }

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `LiveTracker_Extract_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            this.showError(`Échec de la création du ZIP : ${err.message}`);
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        this.extractBtn.disabled = isLoading;
        this.btnLoader.style.display = isLoading ? 'block' : 'none';
        document.querySelector('.btn-text').style.display = isLoading ? 'none' : 'block';
    }

    showError(msg) {
        this.errorMsg.textContent = msg;
        this.errorMsg.style.display = 'block';
    }

    hideError() {
        this.errorMsg.style.display = 'none';
    }
}

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
