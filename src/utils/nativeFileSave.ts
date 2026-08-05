import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// In a Capacitor Android WebView, the browser-only "blob: URL + <a download> + click()" trick
// silently does nothing - there is no download manager wired up to blob: URLs inside the app's
// WebView (unlike a real mobile browser tab), so every CSV/PDF/Excel export appeared to do
// nothing when run from the installed APK even though the exact same code worked fine in Chrome.
// On native platforms we instead write the file into the app's own cache dir (no storage
// permission needed) and hand it to the OS Share sheet, which lets the user save it to
// Downloads/Drive/etc. or open it directly - the standard Capacitor pattern for "download" a
// generated file. On web, keep the original anchor+blob behavior unchanged.
const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result is "data:<mime>;base64,<data>" - Filesystem.writeFile wants just the payload.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const downloadOnWeb = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Saves (web) or shares (native Android/iOS) a generated file - the single choke point every
// CSV/PDF/Excel export in the app should call instead of a raw anchor-download or `doc.save()`.
export const saveOrShareBlob = async (blob: Blob, filename: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    downloadOnWeb(blob, filename);
    return;
  }
  const base64Data = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  });
  await Share.share({
    title: filename,
    url: written.uri,
  });
};
