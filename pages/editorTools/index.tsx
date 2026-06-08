import { useMeshLocation } from "@uniformdev/mesh-sdk-react";
import {
  Callout,
  LoadingIndicator,
  Button,
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
        backgroundColor: '#22c55e',
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
        backgroundColor: 'white',
        border: '2px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
        }} />
      </div>
    );
  }
  
  return (
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: 'white',
      border: '2px solid #e5e7eb',
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
                  backgroundColor: index < currentIndex ? '#22c55e' : '#e5e7eb',
                }} />
              )}
            </div>
            
            <div style={{
              paddingTop: '2px',
              fontWeight: status === 'current' ? 600 : 400,
              color: status === 'upcoming' ? '#9ca3af' : '#111827',
              fontSize: '13px',
              lineHeight: '20px',
            }}>
              {stage.name}
              {stage.autoPublish && status === 'upcoming' && (
                <span style={{ 
                  marginLeft: '6px',
                  fontSize: '10px',
                  color: '#059669',
                  backgroundColor: '#d1fae5',
                  padding: '1px 4px',
                  borderRadius: '3px',
                }}>
                  auto-publish
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      fontSize: '11px',
      fontWeight: 500,
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: published ? '#d1fae5' : '#fef3c7',
      color: published ? '#059669' : '#d97706',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: published ? '#059669' : '#d97706',
      }} />
      {published ? 'Published' : 'Draft'}
    </span>
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
    entryId: entityType === 'entry' ? entityId : undefined,
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
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <LoadingIndicator />
        <p style={{ marginTop: '8px', color: '#6b7280' }}>Loading workflow...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px' }}>
        <Callout type="error">{error}</Callout>
      </div>
    );
  }

  if (!workflowId) {
    return (
      <div style={{ padding: '16px' }}>
        <Callout type="caution">
          No workflow assigned to this {entityType}.
        </Callout>
      </div>
    );
  }

  const isPublished = state === 64;

  return (
    <div style={{ padding: '12px' }}>
      {/* Header with status */}
      <div style={{ 
        marginBottom: '12px',
        paddingBottom: '8px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '14px', 
          fontWeight: 600,
          color: '#111827'
        }}>
          {workflow?.workflowName || 'Workflow'}
        </h3>
        <StatusBadge published={isPublished} />
      </div>

      {/* Stepper */}
      {workflow?.stages && (
        <WorkflowStepper 
          stages={workflow.stages} 
          currentStageId={effectiveStageId} 
        />
      )}

      {/* Success Message */}
      {transitionSuccess && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#d1fae5',
          color: '#065f46',
          borderRadius: '6px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {transitionSuccess}
        </div>
      )}

      {/* Error Message */}
      {transitionError && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          borderRadius: '6px',
          fontSize: '12px',
        }}>
          {transitionError}
        </div>
      )}

      {/* Available Transitions */}
      {allowedTransitions.length > 0 && (
        <div style={{ 
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb',
        }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 500, 
            color: '#6b7280', 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Available Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allowedTransitions.map((t: Transition) => (
              <Button
                key={t.to}
                buttonType="secondary"
                disabled={transitioning !== null}
                style={{ 
                  width: '100%', 
                  justifyContent: 'center', 
                  fontSize: '12px', 
                  padding: '6px 12px',
                  opacity: transitioning !== null ? 0.7 : 1,
                }}
                onClick={() => handleTransition(t.to)}
              >
                {transitioning === t.to ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <LoadingIndicator size="sm" />
                    Moving...
                  </span>
                ) : (
                  t.name || `Move to ${getTargetStageName(t.to)}`
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* No transitions available message */}
      {transitions.length > 0 && allowedTransitions.length === 0 && (
        <div style={{ 
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #e5e7eb',
          fontSize: '12px',
          color: '#9ca3af',
          fontStyle: 'italic',
        }}>
          No transitions available for your role
        </div>
      )}
    </div>
  );
}
