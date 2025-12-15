
export const pngToIco = async (pngBlob: Blob): Promise<Blob> => {
    const pngData = new Uint8Array(await pngBlob.arrayBuffer());
    const header = new Uint8Array(6);
    const view = new DataView(header.buffer);

    // ICO Header
    view.setUint16(0, 0, true); // Reserved
    view.setUint16(2, 1, true); // Type (1 = ICO)
    view.setUint16(4, 1, true); // Count (1 image)

    // Directory Entry
    const entry = new Uint8Array(16);
    const entryView = new DataView(entry.buffer);

    // Get dimensions (assuming 256x256 for simplicity as set in ConvertPage)
    // For a robust implementation we should parse PNG headers, but we know we set it to 256.
    // 0 means 256 width/height in ICO spec
    entryView.setUint8(0, 0); // Width (256)
    entryView.setUint8(1, 0); // Height (256)
    entryView.setUint8(2, 0); // Palette count (0 = no palette)
    entryView.setUint8(3, 0); // Reserved
    entryView.setUint16(4, 1, true); // Color planes
    entryView.setUint16(6, 32, true); // Bits per pixel
    entryView.setUint32(8, pngData.length, true); // Size of image data
    entryView.setUint32(12, 6 + 16, true); // Offset (Header + Directory)

    // Combine
    const icoData = new Uint8Array(header.length + entry.length + pngData.length);
    icoData.set(header, 0);
    icoData.set(entry, header.length);
    icoData.set(pngData, header.length + entry.length);

    return new Blob([icoData], { type: 'image/x-icon' });
};
