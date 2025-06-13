import React from 'react';
import { X, FileImage, FileText } from 'lucide-react';

const ExportMenu = ({ 
  isOpen, 
  onClose, 
  onExport,
  focusedArea 
}) => {
  if (!isOpen) return null;

  const handleExport = (format) => {
    onExport(format);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Export Siteplan
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {focusedArea ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">
                    Current Focus Area
                  </h3>
                  <p className="text-sm text-gray-600">
                    {focusedArea.properties.name || 'Unnamed Area'}
                  </p>
                  {focusedArea.properties.propertyname && (
                    <p className="text-xs text-gray-500">
                      {focusedArea.properties.propertyname}
                      {focusedArea.properties.subpropertyname && 
                        ` › ${focusedArea.properties.subpropertyname}`
                      }
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">
                    Choose export format:
                  </p>
                  
                  <button
                    onClick={() => handleExport('png')}
                    className="w-full flex items-center space-x-3 p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <FileImage className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-gray-900">PNG Image</div>
                      <div className="text-xs text-gray-500">
                        High-quality image for digital use
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExport('jpg')}
                    className="w-full flex items-center space-x-3 p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <FileImage className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium text-gray-900">JPG Image</div>
                      <div className="text-xs text-gray-500">
                        Compressed image for sharing
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full flex items-center space-x-3 p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-red-600" />
                    <div>
                      <div className="font-medium text-gray-900">PDF Document</div>
                      <div className="text-xs text-gray-500">
                        Professional document for permits
                      </div>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <FileImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  No Area Focused
                </h3>
                <p className="text-sm text-gray-500">
                  Please focus on a permit area first to export a siteplan.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 rounded-b-lg">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExportMenu;
