import PageClient from "./page-client";

export function generateStaticParams() {
  return [{ username: "_" }];
}

export default function Page() {
  return <PageClient />;
}
