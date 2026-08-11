export const MAX_PROFILE_IMAGE_SIZE_MB = 2;
export const MAX_PROFILE_IMAGE_SIZE_BYTES = MAX_PROFILE_IMAGE_SIZE_MB * 1024 * 1024;
export const PROFILE_IMAGE_SIZE_ERROR = `Profile image must be ${MAX_PROFILE_IMAGE_SIZE_MB}MB or smaller.`;

export const isProfileImageTooLarge = (file) => Boolean(file && file.size > MAX_PROFILE_IMAGE_SIZE_BYTES);

export const readProfileImageAsDataUrl = (file) => new Promise((resolve, reject) => {
    if (!file) {
        resolve('');
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read the selected image.'));
    reader.readAsDataURL(file);
});
