import { useProjectStore } from '@/stores/useProjectStore';
import TabSidebar from '@/components/TabSidebar';
import AppHeader from '@/components/AppHeader';
import SynopsisTab from '@/components/synopsis/SynopsisTab';
import ScriptTab from '@/components/script/ScriptTab';
import StatisticsTab from '@/components/statistics/StatisticsTab';

const Index = () => {
  const { activeTab, setActiveTab } = useProjectStore();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <TabSidebar active={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-col flex-1 min-w-0">
        <AppHeader />
        <main className="flex-1 overflow-hidden">
          {activeTab === 'synopsis' && (
            <div className="h-full overflow-y-auto">
              <SynopsisTab />
            </div>
          )}
          {activeTab === 'script' && <ScriptTab />}
          {activeTab === 'statistics' && (
            <div className="h-full overflow-y-auto">
              <StatisticsTab />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
