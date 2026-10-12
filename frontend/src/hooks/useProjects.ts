"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import type { Project, ProjectDetail } from "@/types/api";

export type LoadStatus = "loading" | "ready" | "error";

function toProject(d: ProjectDetail): Project {
    return {
        id: d.id,
        name: d.name,
        created_at: d.created_at,
        updated_at: d.updated_at,
        page_count: d.page_count,
    };
}

export type CreateResult = {
    project: ProjectDetail;
    importedCount: number;
    importError: string | null;
};

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const applyProjects = useCallback((list: Project[]) => {
        setProjects(list);
        setError(null);
        setStatus("ready");
    }, []);

    const applyProjectError = useCallback((e: unknown) => {
        setError(errorMessage(e, "Could not load projects."));
        setStatus("error");
    }, []);

    const fetchProjects = useCallback(() => {
        const id = ++requestId.current;
        void api.projects.list().then(
            (list) => {
                if (id === requestId.current) applyProjects(list);
            },
            (e: unknown) => {
                if (id === requestId.current) applyProjectError(e);
            },
        );
    }, [applyProjectError, applyProjects]);

    useEffect(() => {
        void fetchProjects();
    }, [fetchProjects]);

    const reload = useCallback(() => {
        setStatus("loading");
        void fetchProjects();
    }, [fetchProjects]);

    const createProject = useCallback(async (name: string, files: File[] = []): Promise<CreateResult> => {
        const project = await api.projects.create(name);
        setProjects((prev) => [toProject(project), ...prev]);
        let importedCount = 0;
        let importError: string | null = null;
        if (files.length > 0) {
            try {
                const result = await api.projects.importFiles(project.id, files);
                importedCount = result.pages.length;
            } catch (e) {
                importError = errorMessage(e, "Import failed.");
            }
        }
        return { project, importedCount, importError };
    }, []);

    const renameProject = useCallback(async (id: number, name: string) => {
        const updated = await api.projects.rename(id, name);
        setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }, []);

    const removeProject = useCallback(async (id: number) => {
        await api.projects.remove(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return { projects, status, error, reload, createProject, renameProject, removeProject };
}