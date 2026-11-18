# HydraTools download site

Simple Node (Express) server + static frontend. May download button na
automatic nagda-download ng `apk/HydraTools.apk`.

## Structure

    server.js          backend (static files, /api/info, /download, /healthz)
    config.json        name, version, telegram, download limit
    apk/HydraTools.apk <- ILAGAY MO DITO ANG APK
    public/            frontend (index.html, css, js, img)
    railway.json       Railway settings

## Bago i-deploy

1. Ilagay ang APK sa `apk/HydraTools.apk` (eksaktong pangalan).
2. Buksan ang `config.json` at ayusin ang `version` kung iba sa app mo.
3. (Optional) Sa `public/index.html`, palitan ang Telegram link kung kailangan.

Ang size, SHA-256 at "Updated" na lumalabas sa site ay kinukuha mismo
sa APK file, kaya laging tugma sa ina-upload mo.

## Local test

    npm install
    npm start        # http://localhost:3000

## Railway

1. I-push ang folder na ito sa GitHub repo.
2. Railway > New Project > Deploy from GitHub repo.
3. Settings > Networking > Generate Domain.

Hindi kailangan ng environment variables. Automatic ang PORT.

Kung lampas 100 MB ang APK, hindi tatanggapin ng GitHub ang normal push.
Gamitin ang Git LFS, o i-deploy gamit ang Railway CLI (`railway up`).

## Notes

- May limit na 20 downloads kada oras kada IP (palitan sa `config.json`).
- Para mag-update ng APK: palitan ang file, i-push, mag-redeploy.

## Kung "APK not uploaded yet" ang lumalabas

Buksan ang `https://<domain-mo>/api/info`. Kapag `"available": false`,
wala ang file sa deployment. Check:

1. Eksaktong `apk/HydraTools.apk` ang path at pangalan (case-sensitive sa Linux).
2. Na-commit at na-push ang file (`git add apk/HydraTools.apk`, commit, push).
3. Kung lampas 100 MB: gamitin ang Railway Volume. Mag-mount ng Volume
   (hal. `/data`), i-upload ang APK doon, tapos mag-set ng variable
   `APK_PATH=/data/HydraTools.apk` sa Railway.

Makikita sa Railway logs ang "APK found" o "APK missing" tuwing mag-start ang server.
