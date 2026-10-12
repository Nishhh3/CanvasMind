
import { notFound } from "next/navigation";
import { EditorShell } from "@/components/editor/EditorShell";

export const instant = false;

export default async function ProjectEditorPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const projectId = Number(id);

    if (!Number.isInteger(projectId) || projectId <= 0) {
        notFound();
    }

    return <EditorShell projectId={projectId} />;
}
