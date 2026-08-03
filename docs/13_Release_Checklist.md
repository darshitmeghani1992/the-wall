# 13 · Release Checklist *(living)*

Steps to ship a build to the stores. Use per release; check as completed.

## Pre-flight (engineering)
- [ ] All V1 acceptance criteria (`03_`) pass on a physical iOS + Android device
- [ ] Definition of Done (`09_`) met for every shipped feature
- [ ] No type/lint errors; CI green
- [ ] Performance budgets (`11_`) met; crash-free target met
- [ ] Security items (`12_`) that are release-blocking are `[in place]`
- [ ] Analytics (`10_`) firing; dashboards set up

## App config
- [ ] `app.json`: name, slug, version, bundle IDs, scheme (`thewall`), icons, splash
- [ ] Permission strings (camera, photos, notifications) accurate & user-friendly
- [ ] Deep-link redirect (`thewall://auth/callback`) registered in Supabase
- [ ] Auth providers (Email, Apple, Google) enabled in Supabase
- [ ] `attachments` storage bucket public + policies correct
- [ ] Production env vars set (EAS secrets)

## Build & submit (EAS)
- [ ] `eas build --platform ios` / `--platform android` succeed
- [ ] Install on device from internal distribution; smoke test the core loop
- [ ] `eas submit` → TestFlight (iOS) / Play internal track (Android)

## Store presence
- [ ] App name, subtitle, description, keywords
- [ ] Screenshots (per device size) + preview
- [ ] Privacy policy URL + data-safety / privacy-nutrition answers
- [ ] Age rating, category, support URL
- [ ] Review notes + a demo account for reviewers

## Post-release
- [ ] Monitor crash-free rate + key funnels (`10_`)
- [ ] Tag the release; update `14_Changelog`
