// src/components/Header/Header.jsx
import React, { useState } from 'react';
import { Map, Info, Upload, Download, FileImage, FileText } from 'lucide-react';
import ExportMenu from '../Modals/ExportMenu';

const Header = ({ 
  showInfo, 
  setShowInfo, 
  onImport, 
  onExport, 
  focusedArea,
  onExportSiteplan 
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <>
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Map className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              NYC Public Space Event Stager
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle Info"
            >
              <Info className="w-5 h-5 text-gray-600" />
            </button>
            <label className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-5 h-5 text-gray-600" />
              <input 
                type="file" 
                accept=".json" 
                onChange={onImport} 
                className="hidden" 
              />
            </label>
            <button
              onClick={onExport}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Export Event Plan"
            >
              <Download className="w-5 h-5 text-gray-600" />
            </button>
            
            {/* Export Siteplan Menu */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!focusedArea}
                className={`p-2 rounded-lg transition-colors ${
                  focusedArea 
                    ? 'hover:bg-gray-100 text-gray-600' 
                    : 'text-gray-400 cursor-not-allowed'
                }`}
                title="Export Permit Area Siteplan"
              >
                <FileImage className="w-5 h-5" />
              </button>
              
              {showExportMenu && focusedArea && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2 px-2">Export Siteplan</div>
                    <button
                      onClick={() => {
                        onExportSiteplan('png');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <FileImage className="w-4 h-4" />
                      <span>PNG Image</span>
                    </button>
                    <button
                      onClick={() => {
                        onExportSiteplan('jpg');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <FileImage className="w-4 h-4" />
                      <span>JPG Image</span>
                    </button>
                    <button
                      onClick={() => {
                        onExportSiteplan('pdf');
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>PDF Document</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </>
  );
};

export default Header;