import { useState, useEffect } from 'react';

type WorkflowTransition = {
  to: string;
  name: string;
  allowedRoles: string[];
};

type WorkflowStage = {
  id: string;
  name: string;
  order?: number;
  transitions?: WorkflowTransition[];
  autoPublish?: boolean;
};

type WorkflowStatus = {
  workflowId: string;
  workflowName: string;
  initialStage: string;
  stages: WorkflowStage[];
  currentStageId?: string;
};

type UseWorkflowStatusParams = {
  projectId: string;
  workflowId: string | undefined;
  entryId?: string;
};

export function useWorkflowStatus({ projectId, workflowId, entryId }: UseWorkflowStatusParams) {
  const [data, setData] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refetchCount, setRefetchCount] = useState(0);

  const refetch = () => setRefetchCount(c => c + 1);

  useEffect(() => {
    if (!workflowId) {
      setData(null);
      setLoading(false);
      return;
    }

    async function fetchWorkflowStatus() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          projectId,
          workflowId,
        });
        if (entryId) {
          params.append('entryId', entryId);
        }
        // Add timestamp to bust browser cache
        params.append('_t', Date.now().toString());

        const response = await fetch(`/api/workflow-status?${params}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.message || 'Failed to fetch workflow status');
          setData(null);
        }
      } catch (err) {
        setError('Network error');
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkflowStatus();
  }, [projectId, workflowId, entryId, refetchCount]);

  return { data, loading, error, refetch };
}
