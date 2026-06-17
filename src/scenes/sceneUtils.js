// Shared scene helpers.

// Adds (or re-fits) a background image that covers the live canvas with no bars
// and no distortion (cover-fit: scale to the larger of the width/height ratios,
// slight crop allowed). Centered on the canvas. Pass an existing image to refit
// it in place (e.g. on resize) instead of creating a new one.
//
// `scene.scale.width/height` are the live logical dimensions, which match the
// fixed 800x600 on desktop and grow with the device on mobile.
export function coverBackground(scene, key, existing = null) {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const source = scene.textures.get(key).getSourceImage();
  const scale = Math.max(w / source.width, h / source.height);
  const image = existing ?? scene.add.image(0, 0, key);
  image
    .setTexture(key)
    .setOrigin(0.5)
    .setPosition(w / 2, h / 2)
    .setScale(scale);
  return image;
}
