import { notFound } from "next/navigation";
import { getArtifact } from "@/lib/repository";
import { publishKitSchema, type PublishKit } from "@/lib/schemas";
import { PromptViewer } from "./prompt-viewer";

export const dynamic = "force-dynamic";

export default async function HandoffPage({
  params,
}: {
  params: Promise<{ artifactId: string }>;
}) {
  const { artifactId } = await params;
  const artifact = await getArtifact<unknown>(artifactId);

  if (!artifact || artifact.type !== "PublishKit") {
    notFound();
  }

  const parsedPublishKit = publishKitSchema.safeParse(artifact.json_payload);
  if (!parsedPublishKit.success) {
    notFound();
  }

  return <HandoffDocument publishKit={parsedPublishKit.data} />;
}

function HandoffDocument({ publishKit }: { publishKit: PublishKit }) {
  return (
    <main
      style={{
        background: "#f6f7f9",
        color: "#1f2933",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: "100vh",
        padding: "40px 20px",
      }}
    >
      <article
        style={{
          background: "#ffffff",
          border: "1px solid #d9dee7",
          borderRadius: 8,
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
          margin: "0 auto",
          maxWidth: 980,
          overflow: "hidden",
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #e4e7ec",
            padding: "28px 32px",
          }}
        >
          <p
            style={{
              color: "#25201a",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0,
              margin: "0 0 10px",
              textTransform: "uppercase",
            }}
          >
            Codex Handoff
          </p>
          <h1
            style={{
              fontSize: 30,
              lineHeight: 1.18,
              margin: "0 0 12px",
            }}
          >
            {publishKit.metadata.title}
          </h1>
          <p
            style={{
              color: "#52606d",
              fontSize: 17,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {publishKit.metadata.metaDescription}
          </p>
        </header>

        <PromptViewer prompt={publishKit.codexHandoffPrompt} />
      </article>
    </main>
  );
}
