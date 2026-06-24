import QRCode from 'qrcode';
const generateQR = async (bookingId) => {
    const base64 = await QRCode.toDataURL(bookingId, {
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
    });
    return { base64, bookingId };
};
export { generateQR };
