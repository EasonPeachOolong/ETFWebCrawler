const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 存储服务类
 */
class StorageService {
  constructor() {
    this.dataPath = config.get('storage.dataPath');
    this.enableDatabase = config.get('storage.enableDatabase');
    
    // 确保数据目录存在
    this.ensureDataDirectory();
  }
  
  /**
   * 确保数据目录存在
   */
  ensureDataDirectory() {
    try {
      fs.ensureDirSync(this.dataPath);
      logger.info('数据目录已准备', { path: this.dataPath });
    } catch (error) {
      logger.error('创建数据目录失败', { 
        path: this.dataPath, 
        error: error.message 
      });
      throw error;
    }
  }
  
  /**
   * 检查历史数据是否存在
   * @param {string} crawlerName - 爬虫名称
   * @returns {Promise<boolean>} 是否存在历史数据
   */
  async hasHistoricalData(crawlerName) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      const exists = await fs.pathExists(crawlerPath);
      
      if (!exists) {
        return false;
      }
      
      // 检查是否有数据文件
      const files = await fs.readdir(crawlerPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      logger.info('历史数据检查完成', { 
        crawlerName, 
        exists, 
        fileCount: dataFiles.length 
      });
      
      return dataFiles.length > 0;
    } catch (error) {
      logger.error('检查历史数据失败', { 
        crawlerName, 
        error: error.message 
      });
      return false;
    }
  }
  
  /**
   * 保存数据
   * @param {string} crawlerName - 爬虫名称
   * @param {Array} data - 要保存的数据
   * @param {string} dataType - 数据类型 (historical|daily)
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveData(crawlerName, data, dataType = 'daily') {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      await fs.ensureDir(crawlerPath);
      
      const timestamp = moment().format('YYYY-MM-DD');
      const fileName = `${dataType}_${timestamp}.json`;
      const filePath = path.join(crawlerPath, fileName);
      
      // 如果是增量保存，先读取现有数据
      let existingData = [];
      if (await fs.pathExists(filePath)) {
        try {
          existingData = await fs.readJson(filePath);
          if (!Array.isArray(existingData)) {
            existingData = [];
          }
        } catch (error) {
          logger.warn('读取现有数据失败，将覆盖文件', { 
            filePath, 
            error: error.message 
          });
        }
      }
      
      // 合并数据（去重）
      const mergedData = this.mergeData(existingData, data);
      
      // 保存数据
      await fs.writeJson(filePath, mergedData, { spaces: 2 });
      
      // 保存元数据
      await this.saveMetadata(crawlerName, {
        lastUpdate: moment().toISOString(),
        dataType,
        recordCount: mergedData.length,
        fileName
      });
      
      logger.info('数据保存成功', {
        crawlerName,
        dataType,
        fileName,
        recordCount: mergedData.length,
        newRecords: data.length
      });
      
      return true;
    } catch (error) {
      logger.error('数据保存失败', {
        crawlerName,
        dataType,
        error: error.message
      });
      return false;
    }
  }
  
  /**
   * 读取数据
   * @param {string} crawlerName - 爬虫名称
   * @param {string} dataType - 数据类型
   * @param {string} date - 日期 (YYYY-MM-DD)，可选
   * @returns {Promise<Array>} 数据数组
   */
  async loadData(crawlerName, dataType = 'daily', date = null) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      
      if (!await fs.pathExists(crawlerPath)) {
        return [];
      }
      
      if (date) {
        // 读取特定日期的数据
        const fileName = `${dataType}_${date}.json`;
        const filePath = path.join(crawlerPath, fileName);
        
        if (await fs.pathExists(filePath)) {
          return await fs.readJson(filePath);
        }
        return [];
      } else {
        // 读取最新数据
        const files = await fs.readdir(crawlerPath);
        const dataFiles = files
          .filter(file => file.startsWith(dataType) && file.endsWith('.json'))
          .sort()
          .reverse();
        
        if (dataFiles.length > 0) {
          const latestFile = path.join(crawlerPath, dataFiles[0]);
          return await fs.readJson(latestFile);
        }
        return [];
      }
    } catch (error) {
      logger.error('读取数据失败', {
        crawlerName,
        dataType,
        date,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * 获取所有历史数据
   * @param {string} crawlerName - 爬虫名称
   * @returns {Promise<Array>} 所有历史数据
   */
  async getAllHistoricalData(crawlerName) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      
      if (!await fs.pathExists(crawlerPath)) {
        return [];
      }
      
      const files = await fs.readdir(crawlerPath);
      const dataFiles = files
        .filter(file => file.endsWith('.json') && !file.includes('metadata'))
        .sort();
      
      let allData = [];
      
      for (const file of dataFiles) {
        const filePath = path.join(crawlerPath, file);
        try {
          const data = await fs.readJson(filePath);
          if (Array.isArray(data)) {
            allData = allData.concat(data);
          }
        } catch (error) {
          logger.warn('读取数据文件失败', { file, error: error.message });
        }
      }
      
      // 去重
      allData = this.deduplicateData(allData);
      
      logger.info('加载历史数据完成', {
        crawlerName,
        totalRecords: allData.length,
        fileCount: dataFiles.length
      });
      
      return allData;
    } catch (error) {
      logger.error('获取历史数据失败', {
        crawlerName,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * 保存元数据
   * @param {string} crawlerName - 爬虫名称
   * @param {object} metadata - 元数据
   */
  async saveMetadata(crawlerName, metadata) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      const metadataPath = path.join(crawlerPath, 'metadata.json');
      
      let existingMetadata = {};
      if (await fs.pathExists(metadataPath)) {
        existingMetadata = await fs.readJson(metadataPath);
      }
      
      const updatedMetadata = {
        ...existingMetadata,
        ...metadata,
        updatedAt: moment().toISOString()
      };
      
      await fs.writeJson(metadataPath, updatedMetadata, { spaces: 2 });
    } catch (error) {
      logger.error('保存元数据失败', {
        crawlerName,
        error: error.message
      });
    }
  }
  
  /**
   * 读取元数据
   * @param {string} crawlerName - 爬虫名称
   * @returns {Promise<object>} 元数据对象
   */
  async loadMetadata(crawlerName) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      const metadataPath = path.join(crawlerPath, 'metadata.json');
      
      if (await fs.pathExists(metadataPath)) {
        return await fs.readJson(metadataPath);
      }
      return {};
    } catch (error) {
      logger.error('读取元数据失败', {
        crawlerName,
        error: error.message
      });
      return {};
    }
  }
  
  /**
   * 合并数据（去重）
   * @param {Array} existingData - 现有数据
   * @param {Array} newData - 新数据
   * @returns {Array} 合并后的数据
   */
  mergeData(existingData, newData) {
    const merged = [...existingData, ...newData];
    return this.deduplicateData(merged);
  }
  
  /**
   * 数据去重
   * @param {Array} data - 数据数组
   * @returns {Array} 去重后的数据
   */
  deduplicateData(data) {
    const seen = new Set();
    return data.filter(item => {
      // 使用JSON字符串作为唯一标识
      const key = JSON.stringify(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  /**
   * 清理旧数据
   * @param {string} crawlerName - 爬虫名称
   * @param {number} keepDays - 保留天数
   */
  async cleanupOldData(crawlerName, keepDays = 30) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      
      if (!await fs.pathExists(crawlerPath)) {
        return;
      }
      
      const files = await fs.readdir(crawlerPath);
      const cutoffDate = moment().subtract(keepDays, 'days');
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('metadata')) {
          // 从文件名提取日期
          const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const fileDate = moment(dateMatch[1]);
            if (fileDate.isBefore(cutoffDate)) {
              const filePath = path.join(crawlerPath, file);
              await fs.remove(filePath);
              deletedCount++;
            }
          }
        }
      }
      
      logger.info('清理旧数据完成', {
        crawlerName,
        deletedCount,
        keepDays
      });
    } catch (error) {
      logger.error('清理旧数据失败', {
        crawlerName,
        error: error.message
      });
    }
  }
  
  /**
   * 获取存储统计信息
   * @param {string} crawlerName - 爬虫名称
   * @returns {Promise<object>} 统计信息
   */
  async getStats(crawlerName) {
    try {
      const crawlerPath = path.join(this.dataPath, crawlerName);
      
      if (!await fs.pathExists(crawlerPath)) {
        return {
          exists: false,
          fileCount: 0,
          totalSize: 0,
          lastUpdate: null
        };
      }
      
      const files = await fs.readdir(crawlerPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      for (const file of dataFiles) {
        const filePath = path.join(crawlerPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
      
      const metadata = await this.loadMetadata(crawlerName);
      
      return {
        exists: true,
        fileCount: dataFiles.length,
        totalSize,
        lastUpdate: metadata.lastUpdate,
        recordCount: metadata.recordCount
      };
    } catch (error) {
      logger.error('获取存储统计失败', {
        crawlerName,
        error: error.message
      });
      return {
        exists: false,
        fileCount: 0,
        totalSize: 0,
        lastUpdate: null,
        error: error.message
      };
    }
  }
}

module.exports = StorageService; 