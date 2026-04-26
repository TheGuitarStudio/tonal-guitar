import { source } from "@/app/source";
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";

interface Props {
  params: { slug?: string[] };
}

export default async function Page({ params }: Props) {
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const description = (page.data as any).description as string | undefined;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      {description && <DocsDescription>{description}</DocsDescription>}
      <DocsBody>
        <MDX components={{ ...defaultMdxComponents }} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export function generateMetadata({ params }: Props) {
  const page = source.getPage(params.slug);
  if (!page) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const description = (page.data as any).description as string | undefined;
  return {
    title: page.data.title,
    description,
  };
}
