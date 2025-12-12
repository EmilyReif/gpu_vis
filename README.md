# Pipelining Visualization

A React TypeScript application built with Vite.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

Build the app for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

## GitHub Pages Deployment

### Option 1: Automatic Deployment with GitHub Actions (Recommended)

1. Create a `.github/workflows` directory in your repository
2. The workflow file is already included (`.github/workflows/deploy.yml`)
3. Push your code to GitHub
4. Go to your repository Settings → Pages
5. Under "Source", select "GitHub Actions"
6. The workflow will automatically deploy on every push to `main`

### Option 2: Manual Deployment

1. Build the app: `npm run build`
2. Go to your repository Settings → Pages
3. Under "Source", select "Deploy from a branch"
4. Select the `gh-pages` branch and `/ (root)` folder
5. Push the `dist` folder contents to the `gh-pages` branch

**Note:** Make sure to update the `base` path in `vite.config.ts` if your repository name is different from `pipelining_vis`.

