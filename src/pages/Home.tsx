import { RoleSwitcher } from "../components/RoleSwitcher";
import { StatisticsCards } from "../components/StatisticsCards";
import { FilterPanel } from "../components/FilterPanel";
import { WorkOrderList } from "../components/WorkOrderList";
import { WorkOrderDetail } from "../components/WorkOrderDetail";
import { ImportPreviewModal } from "../components/ImportPreviewModal";
import { ImportHistory } from "../components/ImportHistory";
import { ImportSessionCenter } from "../components/ImportSessionCenter";
import { ImportSessionWorkflow } from "../components/ImportSessionWorkflow";
import { useStore } from "../store/useStore";
import { Settings, Download, RotateCcw, Upload, Lock, FolderOpen, Table } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useState, useRef } from "react";
import { clsx } from "clsx";

export default function Home() {
  const { resetData, getFilteredOrders, stores, exportOrders, currentRole, createImportSession } = useStore();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSessionCenter, setShowSessionCenter] = useState(false);
  const [showSessionWorkflow, setShowSessionWorkflow] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importCsvData, setImportCsvData] = useState<string[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImport = currentRole === 'dispatch';

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      
      if (data.length < 2) {
        alert('CSV 文件内容为空或格式不正确');
        return;
      }

      const headers = data[0];
      const expectedHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号'];
      const hasExpectedHeaders = expectedHeaders.every(h => 
        headers.some(header => header.includes(h) || h.includes(header))
      );

      if (!hasExpectedHeaders && headers.length < 3) {
        alert('CSV 文件格式不正确，请确保包含：门店名称、设备类型、故障描述 等列');
        return;
      }

      setImportFileName(file.name);
      setImportCsvData(data);
      setShowImportModal(true);
    };
    reader.readAsText(file, 'UTF-8');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      
      if (data.length < 2) {
        alert('CSV 文件内容为空或格式不正确');
        return;
      }

      const headers = data[0];
      const targetHeaders = ['门店名称', '设备类型', '故障描述', '状态', '联系人', '联系电话', '期望上门时间', '工单号', '工程师'];
      const headerMapping: Record<number, number> = {};
      
      headers.forEach((header, index) => {
        const normalizedHeader = header.trim();
        const targetIndex = targetHeaders.findIndex(h => 
          normalizedHeader.includes(h) || h.includes(normalizedHeader)
        );
        if (targetIndex !== -1) {
          headerMapping[index] = targetIndex;
        }
      });

      const session = createImportSession(
        file.name,
        headers,
        data,
        targetHeaders,
        headerMapping
      );
      
      setShowSessionCenter(false);
      setShowSessionWorkflow(true);
    };
    reader.readAsText(file, 'UTF-8');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    const orders = getFilteredOrders();
    const timestamp = new Date().toLocaleString('zh-CN').replace(/[/:]/g, '-');
    const name = `工单导出_${timestamp}`;
    
    const headers = [
      '门店名称',
      '设备类型',
      '故障描述',
      '状态',
      '联系人',
      '联系电话',
      '期望上门时间',
      '工单号',
      '工程师',
      '维修记录',
      '回访评价',
      '回访备注',
      '创建时间',
      '更新时间'
    ];

    const escapeCsvField = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = orders.map(order => {
      const store = stores.find(s => s.id === order.storeId);
      return [
        escapeCsvField(store?.name || ''),
        escapeCsvField(order.equipment),
        escapeCsvField(order.description),
        escapeCsvField(order.status),
        escapeCsvField(order.contactName || ''),
        escapeCsvField(order.contactPhone || ''),
        escapeCsvField(order.expectedVisitTime || ''),
        escapeCsvField(order.orderNo),
        escapeCsvField(order.engineerName || ''),
        escapeCsvField(order.repairRecord || ''),
        escapeCsvField(order.reviewRating || ''),
        escapeCsvField(order.reviewRemark || ''),
        escapeCsvField(format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })),
        escapeCsvField(format(new Date(order.updatedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    exportOrders(orders, name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">🔧</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-100">门店报修派工工作台</h1>
                  <p className="text-xs text-slate-500">维修服务全流程管理</p>
                </div>
              </div>
              <RoleSwitcher />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-xl font-medium transition-all duration-200 border border-slate-700/50 hover:border-slate-600/50"
              >
                <Download className="w-4 h-4" />
                导出CSV
              </button>
              {canImport ? (
                <>
                  <Link
                    to="/import-workbench"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all duration-200 border border-indigo-600 hover:border-indigo-500"
                  >
                    <Table className="w-4 h-4" />
                    导入作业台
                  </Link>
                  <button
                    onClick={() => setShowSessionCenter(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-all duration-200 border border-purple-600 hover:border-purple-500"
                  >
                    <FolderOpen className="w-4 h-4" />
                    导入会话中心
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all duration-200 border border-blue-600 hover:border-blue-500"
                  >
                    <Upload className="w-4 h-4" />
                    快速导入
                  </button>
                </>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 text-slate-500 rounded-xl font-medium border border-slate-700/50 cursor-not-allowed"
                  title="只有调度角色才能导入工单"
                >
                  <Lock className="w-4 h-4" />
                  导入CSV
                </button>
              )}
              <button
                onClick={resetData}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 rounded-xl transition-all duration-200 border border-slate-700/50 hover:border-slate-600/50"
                title="重置演示数据"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 py-6">
        <StatisticsCards />
        <FilterPanel />
        <ImportHistory />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-1">
            <WorkOrderList />
          </div>
          <div className="lg:col-span-1">
            <WorkOrderDetail />
          </div>
        </div>
      </div>

      <ImportPreviewModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportCsvData([]);
          setImportFileName('');
        }}
        csvData={importCsvData}
        fileName={importFileName}
      />

      <ImportSessionCenter
        isOpen={showSessionCenter}
        onClose={() => setShowSessionCenter(false)}
        onOpenWorkflow={(sessionId) => {
          setShowSessionCenter(false);
          setShowSessionWorkflow(true);
        }}
      />

      {showSessionWorkflow && (
        <ImportSessionWorkflow
          sessionId={useStore.getState().activeSessionId || ''}
          onClose={() => setShowSessionWorkflow(false)}
        />
      )}
    </div>
  );
}
