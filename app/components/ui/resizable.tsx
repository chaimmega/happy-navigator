"use client";

import { GripVertical } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/app/lib/utils";

interface ResizablePanelGroupProps extends HTMLAttributes<HTMLDivElement> {
  direction: "horizontal" | "vertical";
  children: ReactNode;
}

const ResizablePanelGroup = ({ className, direction, ...props }: ResizablePanelGroupProps) => (
  <Group
    className={cn("flex h-full w-full", className)}
    orientation={direction}
    {...props}
  />
);

const ResizablePanel = Panel;

interface ResizableHandleProps extends HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean;
}

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) => (
  <Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
