const moment = require('moment');

/**
 * 数据解析工具类
 */
class DataParser {
  
  /**
   * 从表格数据中找到最新的有效日期
   * @param {Array} tableRows - 表格行数据
   * @param {number} dateColumnIndex - 日期列索引，默认0
   * @returns {Object|null} 最新日期信息
   */
  static findLatestDate(tableRows, dateColumnIndex = 0) {
    if (!Array.isArray(tableRows) || tableRows.length === 0) {
      return null;
    }

    // 策略1：寻找Total行的前一行（更精确）
    const totalRowIndex = this.findRowByKeyword(tableRows, ['Total', '总计', 'Sum'], dateColumnIndex);
    if (totalRowIndex > 0) {
      const latestRow = tableRows[totalRowIndex - 1];
      const dateStr = latestRow[dateColumnIndex];
      
      if (dateStr && typeof dateStr === 'string' && !this.isNonDateContent(dateStr)) {
        const parsed = this.parseDate(dateStr);
        if (parsed && parsed.isValid()) {
          return {
            dateString: dateStr,
            row: latestRow,
            index: totalRowIndex - 1,
            parsedDate: parsed,
            formattedDate: parsed.format('YYYY-MM-DD'),
            method: 'before_total'
          };
        }
      }
    }

    // 策略2：从后往前遍历寻找（备用方案）
    let latestDate = null;
    let latestRow = null;
    let latestIndex = -1;
    let parsedDate = null;

    for (let i = tableRows.length - 1; i >= 0; i--) {
      const row = tableRows[i];
      if (!Array.isArray(row) || row.length <= dateColumnIndex) {
        continue;
      }

      const dateStr = row[dateColumnIndex];
      if (!dateStr || typeof dateStr !== 'string') {
        continue;
      }

      // 跳过明显的非日期内容
      if (this.isNonDateContent(dateStr)) {
        continue;
      }

      // 尝试解析日期
      const parsed = this.parseDate(dateStr);
      if (parsed && parsed.isValid()) {
        latestDate = dateStr;
        latestRow = row;
        latestIndex = i;
        parsedDate = parsed;
        break;
      }
    }

    if (latestDate) {
      return {
        dateString: latestDate,
        row: latestRow,
        index: latestIndex,
        parsedDate: parsedDate,
        formattedDate: parsedDate.format('YYYY-MM-DD'),
        method: 'reverse_scan'
      };
    }

    return null;
  }

  /**
   * 根据关键词查找行索引
   * @param {Array} tableRows - 表格行数据
   * @param {Array} keywords - 关键词数组
   * @param {number} columnIndex - 搜索的列索引
   * @returns {number} 行索引，未找到返回-1
   */
  static findRowByKeyword(tableRows, keywords, columnIndex = 0) {
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      if (!Array.isArray(row) || row.length <= columnIndex) {
        continue;
      }

      const cellValue = row[columnIndex];
      if (cellValue && typeof cellValue === 'string') {
        const normalized = cellValue.trim().toLowerCase();
        for (const keyword of keywords) {
          if (normalized === keyword.toLowerCase()) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  /**
   * 判断是否为非日期内容
   * @param {string} str - 待检查的字符串
   * @returns {boolean} 是否为非日期内容
   */
  static isNonDateContent(str) {
    const nonDatePatterns = [
      /^(Date|日期)$/i,           // 表头
      /^(Total|总计|合计)$/i,      // 汇总行
      /^(Average|平均)$/i,        // 平均值行
      /^(Minimum|最小|最小值)$/i,  // 最小值行
      /^(Maximum|最大|最大值)$/i,  // 最大值行
      /^(Sum|求和)$/i,           // 求和行
      /^-+$/,                   // 分隔线
      /^\s*$/                   // 空白
    ];

    return nonDatePatterns.some(pattern => pattern.test(str.trim()));
  }

  /**
   * 解析多种日期格式
   * @param {string} dateStr - 日期字符串
   * @returns {moment.Moment|null} 解析后的日期对象
   */
  static parseDate(dateStr) {
    if (!dateStr) return null;

    const dateFormats = [
      'DD MMM YYYY',    // "31 Dec 2024"
      'D MMM YYYY',     // "1 Jan 2024"
      'YYYY-MM-DD',     // "2024-12-31"
      'YYYY/MM/DD',     // "2024/12/31"
      'DD/MM/YYYY',     // "31/12/2024"
      'MM/DD/YYYY',     // "12/31/2024"
      'DD-MM-YYYY',     // "31-12-2024"
      'YYYY年MM月DD日',  // 中文格式
    ];

    for (const format of dateFormats) {
      const parsed = moment(dateStr.trim(), format, true);
      if (parsed.isValid()) {
        return parsed;
      }
    }

    // 如果标准格式都不匹配，尝试自动解析
    const autoParsed = moment(dateStr.trim());
    return autoParsed.isValid() ? autoParsed : null;
  }

  /**
   * 从表格数据中提取时间序列
   * @param {Array} tableRows - 表格行数据
   * @param {number} dateColumnIndex - 日期列索引
   * @returns {Array} 时间序列数据
   */
  static extractTimeSeries(tableRows, dateColumnIndex = 0) {
    if (!Array.isArray(tableRows)) {
      return [];
    }

    const timeSeries = [];

    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      if (!Array.isArray(row) || row.length <= dateColumnIndex) {
        continue;
      }

      const dateStr = row[dateColumnIndex];
      if (this.isNonDateContent(dateStr)) {
        continue;
      }

      const parsed = this.parseDate(dateStr);
      if (parsed && parsed.isValid()) {
        timeSeries.push({
          dateString: dateStr,
          parsedDate: parsed,
          formattedDate: parsed.format('YYYY-MM-DD'),
          row: row,
          index: i
        });
      }
    }

    // 按日期排序
    timeSeries.sort((a, b) => a.parsedDate.valueOf() - b.parsedDate.valueOf());

    return timeSeries;
  }

  /**
   * 获取数据的日期范围
   * @param {Array} tableRows - 表格行数据
   * @param {number} dateColumnIndex - 日期列索引
   * @returns {Object|null} 日期范围信息
   */
  static getDateRange(tableRows, dateColumnIndex = 0) {
    const timeSeries = this.extractTimeSeries(tableRows, dateColumnIndex);
    
    if (timeSeries.length === 0) {
      return null;
    }

    const earliest = timeSeries[0];
    const latest = timeSeries[timeSeries.length - 1];

    return {
      earliest: {
        dateString: earliest.dateString,
        formattedDate: earliest.formattedDate,
        parsedDate: earliest.parsedDate
      },
      latest: {
        dateString: latest.dateString,
        formattedDate: latest.formattedDate,
        parsedDate: latest.parsedDate
      },
      totalDays: timeSeries.length,
      daysBetween: latest.parsedDate.diff(earliest.parsedDate, 'days') + 1
    };
  }

  /**
   * 验证数据完整性
   * @param {Array} tableRows - 表格行数据
   * @param {number} dateColumnIndex - 日期列索引
   * @returns {Object} 数据完整性报告
   */
  static validateDataIntegrity(tableRows, dateColumnIndex = 0) {
    const timeSeries = this.extractTimeSeries(tableRows, dateColumnIndex);
    const gaps = [];
    const duplicates = [];
    
    if (timeSeries.length < 2) {
      return {
        isValid: timeSeries.length === 1,
        totalRecords: timeSeries.length,
        gaps: [],
        duplicates: [],
        issues: timeSeries.length === 0 ? ['无有效日期数据'] : []
      };
    }

    // 检查日期间隔和重复
    for (let i = 1; i < timeSeries.length; i++) {
      const prev = timeSeries[i - 1];
      const curr = timeSeries[i];
      
      // 检查重复日期
      if (prev.formattedDate === curr.formattedDate) {
        duplicates.push({
          date: curr.formattedDate,
          indices: [prev.index, curr.index]
        });
      }
      
      // 检查日期间隔（跳过周末可以理解）
      const daysDiff = curr.parsedDate.diff(prev.parsedDate, 'days');
      if (daysDiff > 4) { // 超过4天可能是数据缺失
        gaps.push({
          from: prev.formattedDate,
          to: curr.formattedDate,
          daysMissing: daysDiff - 1
        });
      }
    }

    const issues = [];
    if (gaps.length > 0) issues.push(`发现${gaps.length}个数据间隔`);
    if (duplicates.length > 0) issues.push(`发现${duplicates.length}个重复日期`);

    return {
      isValid: issues.length === 0,
      totalRecords: timeSeries.length,
      gaps,
      duplicates,
      issues
    };
  }
}

module.exports = DataParser; 