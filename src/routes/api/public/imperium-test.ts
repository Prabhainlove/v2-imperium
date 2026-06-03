import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/imperium-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          role?: string;
          location?: string;
          skills?: string;
          max_applications?: number;
        };
        const { runPipeline } = await import("@/lib/imperium/pipeline.server");
        const task_id = `test_${Date.now().toString(36)}`;
        const result = await runPipeline({
          task_id,
          role: body.role ?? "AI Engineer",
          location: body.location ?? "Remote",
          experience: "3 years",
          skills: (body.skills ?? "Python,PyTorch,LLMs,FastAPI")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          candidate: {
            name: "Test Candidate",
            email: "test@example.com",
            phone: "",
          },
          max_applications: body.max_applications ?? 3,
        });
        return Response.json(result);
      },
    },
  },
});
