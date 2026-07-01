This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## X Ads tracking

Use a tagged URL for the current X promotion so LP visits, trial starts, checkout starts, and purchases stay tied together in `/admin`:

```text
https://oneflash.bantex.jp/?utm_source=x&utm_medium=paid_social&utm_campaign=oneflash_9500_202607&utm_content=ad01
```

The app also captures `twclid` when X Ads appends it. The admin API defaults the campaign spend to `9500` yen for the OnePage-Flash tab; override it with `X_AD_SPEND_YEN` or `/api/admin/stats?...&service=opf&x_ad_spend_yen=9500`.

Optional X Pixel env vars:

```text
NEXT_PUBLIC_X_PIXEL_ID=
NEXT_PUBLIC_X_EVENT_PREVIEW_ID=
NEXT_PUBLIC_X_EVENT_GENERATE_ID=
NEXT_PUBLIC_X_EVENT_CHECKOUT_ID=
NEXT_PUBLIC_X_EVENT_PURCHASE_ID=
```
