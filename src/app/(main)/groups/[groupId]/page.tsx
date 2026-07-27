import PageClient from "./page-client";

export function generateStaticParams() {
  return [{ groupId: "_" }];
}

export default function Page() {
  return <PageClient />;
}
