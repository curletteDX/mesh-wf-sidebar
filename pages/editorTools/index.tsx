import { useMeshLocation } from "@uniformdev/mesh-sdk-react";
import {
  Callout,
  LoadingIndicator,
  Button,
  StatusBullet,
  Chip,
  Heading,
  VerticalRhythm,
  HorizontalRhythm,
  Caption,
} from "@uniformdev/design-system";
import React, { useState } from "react";
import { useWorkflowStatus } from "../../hooks";

type StepStatus = 'completed' | 'current' | 'upcoming';

type Transition = {
  to: string;
  name: string;
  allowedRoles: string[];
};

type Stage = {
  id: string;
  name: string;
  transitions?: Transition[];
  autoPublish?: boolean;
};

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-success, #22c55e)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path 
            d="M13.5 4.5L6 12L2.5 8.5" 
            stroke="white" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  
  if (status === 'current') {
    return (
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-background, white)',
        border: '2px solid var(--color-border, #e5e7eb)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary, #3b82f6)',
        }} />
      </div>
    );
  }
  
  return (
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: 'var(--color-background, white)',
      border: '2px solid var(--color-border, #e5e7eb)',
      flexShrink: 0,
    }} />
  );
}

function WorkflowStepper({ 
  stages, 
  currentStageId 
}: { 
  stages: Stage[];
  currentStageId: string | undefined;
}) {
  const currentIndex = stages.findIndex(s => s.id === currentStageId);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {stages.map((stage, index) => {
        let status: StepStatus = 'upcoming';
        if (currentIndex >= 0) {
          if (index < currentIndex) status = 'completed';
          else if (index === currentIndex) status = 'current';
        }
        
        const isLast = index === stages.length - 1;
        
        return (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '12px' }}>
              <StepIcon status={status} />
              {!isLast && (
                <div style={{
                  width: '2px',
                  height: '24px',
                  backgroundColor: index < currentIndex ? 'var(--color-success, #22c55e)' : 'var(--color-border, #e5e7eb)',
                }} />
              )}
            </div>
            
            <div style={{
              paddingTop: '2px',
              fontWeight: status === 'current' ? 600 : 400,
              color: status === 'upcoming' ? 'var(--color-text-tertiary, #9ca3af)' : 'var(--color-text-primary, #111827)',
              fontSize: '13px',
              lineHeight: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              {stage.name}
              {stage.autoPublish && status === 'upcoming' && (
                <Chip text="auto-publish" size="sm" theme="utility-success" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export default function EditorTools() {
  const { value, metadata } = useMeshLocation<"canvasEditorTools">();

  const { entityType, rootEntity } = value;
  const projectId = metadata.projectId;
  const entityId = (rootEntity as any)._id;
  const user = (metadata as any).user || {};
  const userRoles = user.roles || [];
  const isAdmin = user.isAdmin || false;
  const state = (metadata as any).state; // 0 = draft, 64 = published
  
  const contentTypeId = (rootEntity as any)._type || (rootEntity as any).type;
  const componentDefs = (metadata as any).componentDefinitions || {};
  const contentTypeDefinition = contentTypeId ? componentDefs[contentTypeId] : null;
  const workflowId = contentTypeDefinition?.workflowId;

  const { data: workflow, loading, error, refetch } = useWorkflowStatus({
    projectId,
    workflowId,
    entityId,
    entityType: entityType as 'entry' | 'composition',
  });

  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitionSuccess, setTransitionSuccess] = useState<string | null>(null);

  const effectiveStageId = workflow?.currentStageId || workflow?.initialStage;
  
  // Find current stage and its available transitions
  const currentStage = workflow?.stages?.find((s: Stage) => s.id === effectiveStageId);
  const transitions = currentStage?.transitions || [];
  
  // Filter transitions based on user permissions
  const allowedTransitions = transitions.filter((t: Transition) => {
    if (isAdmin) return true;
    if (t.allowedRoles.length === 0) return true;
    return t.allowedRoles.some(role => userRoles.includes(role));
  });

  // Get target stage names for transitions
  const getTargetStageName = (toId: string) => {
    const stage = workflow?.stages?.find((s: Stage) => s.id === toId);
    return stage?.name || toId;
  };

  // Handle workflow transition
  const handleTransition = async (targetStageId: string) => {
    setTransitioning(targetStageId);
    setTransitionError(null);
    setTransitionSuccess(null);

    try {
      const response = await fetch('/api/workflow-transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          entityId,
          entityType,
          targetStageId,
          workflowId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setTransitionSuccess(`Moved to ${getTargetStageName(targetStageId)}`);
        // Add delay before refetching to allow Uniform to propagate the change
        setTimeout(() => {
          refetch();
        }, 2500);
        // Clear success message after a bit longer
        setTimeout(() => {
          setTransitionSuccess(null);
        }, 4000);
      } else {
        setTransitionError(result.message || 'Failed to transition');
      }
    } catch (err) {
      setTransitionError('Network error during transition');
    } finally {
      setTransitioning(null);
    }
  };

  if (loading) {
    return (
      <VerticalRhythm gap="sm" style={{ padding: 'var(--spacing-lg, 24px)', textAlign: 'center' }}>
        <LoadingIndicator />
        <Caption>Loading workflow...</Caption>
      </VerticalRhythm>
    );
  }

  if (error) {
    return (
      <VerticalRhythm style={{ padding: 'var(--spacing-md, 16px)' }}>
        <Callout type="error">{error}</Callout>
      </VerticalRhythm>
    );
  }

  if (!workflowId) {
    return (
      <VerticalRhythm style={{ padding: 'var(--spacing-md, 16px)' }}>
        <Callout type="caution">
          No workflow assigned to this {entityType}.
        </Callout>
      </VerticalRhythm>
    );
  }

  const isPublished = state === 64;

  return (
    <VerticalRhythm gap="md" style={{ padding: 'var(--spacing-sm, 12px)' }}>
      <HorizontalRhythm 
        justify="space-between" 
        align="center"
        style={{ 
          paddingBottom: 'var(--spacing-sm, 8px)',
          borderBottom: '1px solid var(--color-border, #e5e7eb)',
        }}
      >
        <Heading level={4} style={{ margin: 0 }}>
          {workflow?.workflowName || 'Workflow'}
        </Heading>
        <StatusBullet status={isPublished ? "Published" : "Draft"} size="sm" />
      </HorizontalRhythm>

      {/* Stepper */}
      {workflow?.stages && (
        <WorkflowStepper 
          stages={workflow.stages} 
          currentStageId={effectiveStageId} 
        />
      )}

      {transitionSuccess && (
        <Callout type="success" compact>
          {transitionSuccess}
        </Callout>
      )}

      {transitionError && (
        <Callout type="error" compact>
          {transitionError}
        </Callout>
      )}

      {allowedTransitions.length > 0 && (
        <VerticalRhythm 
          gap="sm"
          style={{ 
            paddingTop: 'var(--spacing-sm, 12px)',
            borderTop: '1px solid var(--color-border, #e5e7eb)',
          }}
        >
          <Caption style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Available Actions
          </Caption>
          <VerticalRhythm gap="xs">
            {allowedTransitions.map((t: Transition) => (
              <Button
                key={t.to}
                buttonType="secondary"
                disabled={transitioning !== null}
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => handleTransition(t.to)}
              >
                {transitioning === t.to ? (
                  <HorizontalRhythm gap="sm" align="center">
                    <LoadingIndicator size="sm" />
                    <span>Moving...</span>
                  </HorizontalRhythm>
                ) : (
                  t.name || `Move to ${getTargetStageName(t.to)}`
                )}
              </Button>
            ))}
          </VerticalRhythm>
        </VerticalRhythm>
      )}

      {transitions.length > 0 && allowedTransitions.length === 0 && (
        <Caption 
          style={{ 
            paddingTop: 'var(--spacing-sm, 12px)',
            borderTop: '1px solid var(--color-border, #e5e7eb)',
            fontStyle: 'italic',
          }}
        >
          No transitions available for your role
        </Caption>
      )}
    </VerticalRhythm>
  );
}
