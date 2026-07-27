import PageClient from "./page-client";

export function generateStaticParams() {
  return [{ eventId: "_" }];
}

export default function Page() {
  return <PageClient />;
}
