const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const prismaSrcDir = path.join(__dirname, "..", "src", "prisma");
const prismaDistDir = path.join(distDir, "prisma");
const publicSrcDir = path.join(__dirname, "..", "public");
const publicDistDir = path.join(distDir, "public");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  ensureDir(destDir);
  fs.copyFileSync(src, dest);
}

console.log("Copying assets to dist folder...");

ensureDir(distDir);

if (fs.existsSync(prismaSrcDir)) {
  console.log("Copying prisma files...");
  copyDir(prismaSrcDir, prismaDistDir);
}

if (fs.existsSync(publicSrcDir)) {
  console.log("Copying public files...");
  copyDir(publicSrcDir, publicDistDir);
}

const clientDistDir = path.join(__dirname, "..", "..", "client", "dist");
const clientTargetDir = path.join(distDir, "client");
if (fs.existsSync(clientDistDir)) {
  console.log("Copying client build...");
  copyDir(clientDistDir, clientTargetDir);
}

console.log("Assets copied successfully!");
