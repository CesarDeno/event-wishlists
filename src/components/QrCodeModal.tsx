import { useEffect, useMemo, useRef } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeModalProps {
  title: string;
  slug: string;
  url: string;
  onClose: () => void;
}

export function QrCodeModal({ title, slug, url, onClose }: QrCodeModalProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const matrix = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const size = qr.getModuleCount();
    const cells: Array<{ x: number; y: number }> = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (qr.isDark(row, col)) {
          cells.push({ x: col, y: row });
        }
      }
    }
    return { size, cells };
  }, [url]);

  function handleDownloadSvg() {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `qr-${slug}.svg`;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }

  const padding = 3;
  const viewSize = matrix.size + padding * 2;

  return (
    <div
      className="quicklook-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Código QR de ${title}`}
      onClick={onClose}
    >
      <div
        className="quicklook-dialog qr-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="quicklook-header">
          <div className="quicklook-meta">
            <strong>{title}</strong>
            <span className="muted small-text">/l/{slug}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        <div className="qr-svg-wrap">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewSize} ${viewSize}`}
            width="220"
            height="220"
            shapeRendering="crispEdges"
            role="img"
            aria-label={`QR hacia ${url}`}
          >
            <rect width={viewSize} height={viewSize} fill="#ffffff" />
            <g fill="#111111">
              {matrix.cells.map((cell) => (
                <rect
                  key={`${cell.x}-${cell.y}`}
                  x={cell.x + padding}
                  y={cell.y + padding}
                  width="1"
                  height="1"
                />
              ))}
            </g>
          </svg>
        </div>

        <p className="muted small-text qr-url">{url}</p>

        <button
          type="button"
          className="btn btn-primary item-cta"
          onClick={handleDownloadSvg}
        >
          Descargar QR (SVG)
        </button>
      </div>
    </div>
  );
}

