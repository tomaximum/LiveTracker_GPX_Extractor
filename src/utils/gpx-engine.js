/**
 * Gère la génération de fichiers GPX v1.1
 */
export class GPXEngine {
    /**
     * Génère un XML GPX à partir d'un nom et d'une liste de points
     */
    static generate(name, points) {
        let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LiveTracker GPX Extractor" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${this.escapeXml(name)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${this.escapeXml(name)}</name>
    <trkseg>`;

        points.forEach(p => {
            const lat = p.lat || p.latitude;
            const lng = p.lng || p.longitude;
            const alt = p.alt || p.altitude || 0;
            const time = p.t || p.time;

            gpx += `
      <trkpt lat="${lat}" lon="${lng}">
        <ele>${alt}</ele>${time ? `\n        <time>${this.formatTime(time)}</time>` : ''}
      </trkpt>`;
        });

        gpx += `
    </trkseg>
  </trk>
</gpx>`;
        return gpx;
    }

    static formatTime(t) {
        if (typeof t === 'string' && t.includes('T')) return t;
        if (typeof t === 'number') return new Date(t).toISOString();
        return null;
    }

    static escapeXml(unsafe) {
        if (!unsafe) return "";
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    /**
     * Déclenche le téléchargement d'un fichier
     */
    static download(name, content, mimeType = 'application/gpx+xml') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name.endsWith('.gpx') ? name : `${name}.gpx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
