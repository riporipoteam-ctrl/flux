import PageClient from "./page-client";

export function generateStaticParams() {
  return [{ postId: "_" }];
}

export default function Page() {
  return <PageClient />;
}
