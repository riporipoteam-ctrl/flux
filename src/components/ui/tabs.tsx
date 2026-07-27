"use client";

import * as React from "react";
import {
  Root as TabsRoot,
  List as TabsListPrimitive,
  Trigger as TabsTriggerPrimitive,
  Content as TabsContentPrimitive,
} from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsRoot;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsListPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsListPrimitive>
>(({ className, ...props }, ref) => (
  <TabsListPrimitive
    ref={ref}
    className={cn(
      "inline-flex h-12 w-full items-center justify-center border-b border-border/70 bg-transparent",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <TabsTriggerPrimitive
    ref={ref}
    className={cn(
      "relative inline-flex h-full flex-1 items-center justify-center whitespace-nowrap px-4 text-sm font-semibold text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground data-[state=active]:text-foreground after:absolute after:bottom-0 after:h-1 after:w-12 after:rounded-full after:bg-transparent after:transition-all data-[state=active]:after:bg-primary",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsContentPrimitive>
>(({ className, ...props }, ref) => (
  <TabsContentPrimitive
    ref={ref}
    className={cn("mt-0 focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
