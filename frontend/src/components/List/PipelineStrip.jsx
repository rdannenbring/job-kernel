import React from 'react';
import { KANBAN_COLUMNS, TERMINAL_COLUMNS, SUBSTAGE_COUNTS } from '../Kanban/stages.js';

// Active pipeline stages (drop Inbox — it's pre-pipeline)
const PIPE_STAGES = KANBAN_COLUMNS.slice(1); // Saved..Accepted

export default function PipelineStrip({ stage, subProgress = 0 }) {
  const isTerminal = TERMINAL_COLUMNS.includes(stage);
  const stageIdx = isTerminal ? -1 : PIPE_STAGES.indexOf(stage); // 0..5
  const subCount = SUBSTAGE_COUNTS[stage] || 0;

  return (
    <div className="lpipe">
      <div className="lpipe-steps">
        {PIPE_STAGES.map((s, i) => {
          const passed  = !isTerminal && i < stageIdx;
          const current = !isTerminal && i === stageIdx;
          let cls = '';
          if (passed)  cls = 'is-passed';
          if (current) cls = 'is-current';
          // Terminal: paint all segments in terminal color
          if (isTerminal) cls = `s-${stage.toLowerCase()}`;
          return (
            <span
              key={s}
              className={`lpipe-step ${cls}`}
              title={s}
            />
          );
        })}
      </div>
      <span className="lpipe-label">
        {stage}
        {!isTerminal && subCount > 0 && ` ${subProgress}/${subCount}`}
      </span>
    </div>
  );
}
