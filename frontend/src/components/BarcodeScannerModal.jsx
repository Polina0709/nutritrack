// frontend/src/components/BarcodeScannerModal.jsx
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './BarcodeScannerModal.css';

const READER_ELEMENT_ID = 'nutritrack-barcode-reader';

const BarcodeScannerModal = ({ isOpen, onClose, onDetected, theme = 'light' }) => {
    const [cameraError, setCameraError] = useState('');
    const [manualCode, setManualCode] = useState('');
    const [isStarting, setIsStarting] = useState(false);

    const scannerRef = useRef(null);
    const hasScannedRef = useRef(false);

    useEffect(() => {
        if (!isOpen) return;

        let isCancelled = false;
        hasScannedRef.current = false;
        setCameraError('');
        setManualCode('');
        setIsStarting(true);

        const html5QrCode = new Html5Qrcode(READER_ELEMENT_ID);
        scannerRef.current = html5QrCode;

        const startScanner = async () => {
            try {
                await html5QrCode.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 130 },
                        aspectRatio: 1.333,
                    },
                    async (decodedText) => {
                        if (hasScannedRef.current || isCancelled) return;
                        const digits = String(decodedText || '').replace(/\D/g, '');
                        if (!digits) return;

                        hasScannedRef.current = true;
                        try {
                            if (html5QrCode.isScanning) {
                                await html5QrCode.stop();
                            }
                            await html5QrCode.clear();
                        } catch {
                            // Ігноруємо помилку зупинки при швидкому закритті
                        }
                        onDetected(digits);
                    },
                    () => {
                        // Ігноруємо проміжні кадри без штрихкоду
                    }
                );
            } catch {
                if (!isCancelled) {
                    setCameraError(
                        'Не вдалося відкрити камеру. Надайте дозвіл у налаштуваннях браузера або введіть цифри штрихкоду вручну нижче.'
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsStarting(false);
                }
            }
        };

        startScanner();

        return () => {
            isCancelled = true;
            const instance = scannerRef.current;
            if (instance) {
                Promise.resolve()
                    .then(() => (instance.isScanning ? instance.stop() : null))
                    .then(() => instance.clear())
                    .catch(() => {});
            }
        };
    }, [isOpen, onDetected]);

    if (!isOpen) return null;

    const handleManualSubmit = (e) => {
        e.preventDefault();
        const digits = manualCode.replace(/\D/g, '');
        if (!digits) return;
        onDetected(digits);
    };

    return (
        <div onClick={onClose} className={`barcode-scanner-overlay ${theme}`}>
            <div onClick={(e) => e.stopPropagation()} className="bs-modal">
                <button
                    type="button"
                    onClick={onClose}
                    className="bs-close-btn"
                    title="Закрити сканер"
                    aria-label="Закрити сканер"
                >
                    ✕
                </button>

                <h4 className="bs-title">📷 Сканер штрихкоду</h4>
                <p className="bs-subtitle">
                    Наведіть камеру на штрихкод (EAN-13 / UPC) на упаковці продукту
                </p>

                <div className="bs-viewport-wrap">
                    <div id={READER_ELEMENT_ID} className="bs-reader-box" />
                    {isStarting && (
                        <div className="bs-status-overlay">Запуск камери...</div>
                    )}
                </div>

                {cameraError && <div className="bs-error">{cameraError}</div>}

                <form onSubmit={handleManualSubmit} className="bs-manual-form">
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Або введіть цифри штрихкоду..."
                        className="bs-manual-input"
                    />
                    <button type="submit" className="bs-manual-btn">
                        Пошук
                    </button>
                </form>
            </div>
        </div>
    );
};

export default BarcodeScannerModal;