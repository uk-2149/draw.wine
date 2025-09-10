export class ImageLoader {
  private static imageCache: Map<string, HTMLImageElement> = new Map();
  private static loadingPromises: Map<string, Promise<HTMLImageElement>> =
    new Map();

  static load(url: string): Promise<HTMLImageElement> {
    // Return cached image if available
    if (this.imageCache.has(url)) {
      return Promise.resolve(this.imageCache.get(url)!);
    }

    // Return existing promise if image is already loading
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Create new loading promise
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        this.imageCache.set(url, img);
        this.loadingPromises.delete(url);
        resolve(img);
      };
      img.onerror = (error) => {
        this.loadingPromises.delete(url);
        reject(error);
      };
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  static getFromCache(url: string): HTMLImageElement | null {
    return this.imageCache.get(url) || null;
  }

  static clear() {
    this.imageCache.clear();
    this.loadingPromises.clear();
  }
}
