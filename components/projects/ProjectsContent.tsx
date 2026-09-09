"use client";

import  { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteClip } from "@/lib/queries";
import DashboardLayout from "@/components/shared/DashboardLayout";
import ProjectFilters from "@/components/projects/ProjectFilters";
import ClipGrid from "@/components/projects/ClipGrid";
import SelectionFooter from "@/components/projects/SelectionFooter";

interface Project {
  id: string;
  title: string;
  thumbnail: string | null;
  clipUrl: string | null;
  score: number;
  scoreKey: string;
  duration: string;
  style?: string;
}

interface ProjectsContentProps {
  clips: Project[];
}

export default function ProjectsContent({ clips }: ProjectsContentProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captionsStyle, setCaptionsStyle] = useState("All Styles");
  const [viralityLevels, setViralityLevels] = useState<string[]>(["high", "medium", "low"]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleDeleteClip = async (id: string) => {
    try {
      await deleteClip(id);
      // Invalidate both the scoped and global queries
      queryClient.invalidateQueries({ queryKey: ["projectsData"] });
    } catch (error) {
      console.error("Failed to delete clip:", error);
      throw error;
    }
  };

  const handleBatchDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => deleteClip(id)));
      queryClient.invalidateQueries({ queryKey: ["projectsData"] });
    } catch (error) {
      console.error("Failed to batch delete clips:", error);
      throw error;
    }
  };



  // Filtering Logic
  const filteredClips = clips.filter((clip: Project) => {
    const matchesStyle = captionsStyle === "All Styles" || clip.style === captionsStyle;
    const matchesLevel = viralityLevels.includes(clip.scoreKey);
    return matchesStyle && matchesLevel;
  });

  const activeFilterCount = (captionsStyle !== "All Styles" ? 1 : 0) + (viralityLevels.length < 3 ? 1 : 0);

  const handleViralityToggle = (level: string) => {
    setViralityLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const handleResetFilters = () => {
    setCaptionsStyle("All Styles");
    setViralityLevels(["high", "medium", "low"]);
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredClips.length) {
      setSelectedIds([]);    } else {
      setSelectedIds(filteredClips.map((c: Project) => c.id));
    }
  };

  return (
    <DashboardLayout showSidebar={false} showHeader={false} onMenuClick={() => setSidebarOpen(true)}>
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Project Filters Sidebar (Desktop sticky, Mobile drawer) */}
        <div className={`fixed inset-y-0 left-0 w-[300px] bg-[#080C0B] border-r border-white/5 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:w-[320px] lg:bg-transparent lg:border-r-0 lg:py-10 lg:pl-10 lg:pr-6 lg:shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 lg:p-0 h-full overflow-y-auto scrollbar-hide">
            <ProjectFilters 
              captionsStyle={captionsStyle}
              onCaptionsStyleChange={setCaptionsStyle}
              viralityLevels={viralityLevels}
              onViralityLevelToggle={handleViralityToggle}
              activeFilterCount={activeFilterCount}
              onResetFilters={handleResetFilters}
            />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative z-10 px-6 sm:px-10 lg:px-10 overflow-hidden pt-6">
          <div className="flex-1 flex flex-col overflow-hidden w-full max-w-[1400px] mx-auto">
            {/* Grid Content - now scrollable */}
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide pb-10">
              <ClipGrid 
                clips={filteredClips} 
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onDelete={handleDeleteClip}
              />
            </div>
            
            {/* Docked Actions Footer (now truly always visible and grounded) */}
            <SelectionFooter 
              count={selectedIds.length} 
              selectedIds={selectedIds}
              onDelete={handleBatchDelete}
              onClearSelection={() => setSelectedIds([])}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
