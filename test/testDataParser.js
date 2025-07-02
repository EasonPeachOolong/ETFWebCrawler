const DataParser = require('../src/utils/dataParser');
const StorageService = require('../src/services/storageService');

/**
 * 测试数据解析器的定位策略
 */
async function testDataParser() {
  console.log('🧪 测试数据解析器定位策略\n');
  
  try {
    const storageService = new StorageService();
    
    // 测试Bitcoin ETF数据
    console.log('1️⃣ 测试Bitcoin ETF数据解析');
    console.log('==========================');
    
    const bitcoinData = await storageService.loadData('bitcoin_etf_data');
    if (bitcoinData.length > 0) {
      const tableData = bitcoinData[0];
      
      console.log(`📊 表格信息:`);
      console.log(`   行数: ${tableData.rows.length}`);
      console.log(`   列数: ${tableData.headers.length}`);
      console.log(`   表头: ${tableData.headers.slice(0, 5).join(', ')}...`);
      
      // 查找Total行
      const totalRowIndex = DataParser.findRowByKeyword(tableData.rows, ['Total', '总计', 'Sum']);
      console.log(`\n🔍 Total行定位:`);
      if (totalRowIndex >= 0) {
        console.log(`   Total行索引: ${totalRowIndex}`);
        console.log(`   Total行内容: ${tableData.rows[totalRowIndex].slice(0, 5).join(', ')}...`);
        
        if (totalRowIndex > 0) {
          const beforeTotalRow = tableData.rows[totalRowIndex - 1];
          console.log(`   Total前一行: ${beforeTotalRow.slice(0, 5).join(', ')}...`);
        }
      } else {
        console.log(`   ❌ 未找到Total行`);
      }
      
      // 使用智能定位策略
      console.log(`\n📅 智能日期定位:`);
      const latestInfo = DataParser.findLatestDate(tableData.rows);
      if (latestInfo) {
        console.log(`   ✅ 最新日期: ${latestInfo.dateString}`);
        console.log(`   📆 格式化日期: ${latestInfo.formattedDate}`);
        console.log(`   🎯 定位方法: ${latestInfo.method}`);
        console.log(`   📍 行索引: ${latestInfo.index}`);
        console.log(`   📊 完整行数据: ${latestInfo.row.slice(0, 5).join(', ')}...`);
      } else {
        console.log(`   ❌ 无法定位最新日期`);
      }
      
      // 获取日期范围
      console.log(`\n📈 数据范围分析:`);
      const dateRange = DataParser.getDateRange(tableData.rows);
      if (dateRange) {
        console.log(`   📅 最早日期: ${dateRange.earliest.dateString} (${dateRange.earliest.formattedDate})`);
        console.log(`   📅 最新日期: ${dateRange.latest.dateString} (${dateRange.latest.formattedDate})`);
        console.log(`   📊 有效记录: ${dateRange.totalDays} 条`);
        console.log(`   ⏰ 时间跨度: ${dateRange.daysBetween} 天`);
      }
      
      // 数据完整性验证
      console.log(`\n🔍 数据完整性检查:`);
      const integrity = DataParser.validateDataIntegrity(tableData.rows);
      console.log(`   ✅ 数据有效: ${integrity.isValid ? '是' : '否'}`);
      console.log(`   📊 总记录数: ${integrity.totalRecords}`);
      if (integrity.gaps.length > 0) {
        console.log(`   ⚠️ 数据间隔: ${integrity.gaps.length} 个`);
        integrity.gaps.slice(0, 3).forEach((gap, i) => {
          console.log(`      ${i+1}. ${gap.from} → ${gap.to} (缺失${gap.daysMissing}天)`);
        });
      }
      if (integrity.duplicates.length > 0) {
        console.log(`   ⚠️ 重复日期: ${integrity.duplicates.length} 个`);
      }
      if (integrity.issues.length > 0) {
        console.log(`   ⚠️ 发现问题: ${integrity.issues.join(', ')}`);
      }
      
    } else {
      console.log('⚠️ 无Bitcoin ETF数据');
    }
    
    // 测试模拟数据
    console.log('\n2️⃣ 测试模拟数据结构');
    console.log('==================');
    
    const mockData = [
      ['Date', 'IBIT', 'FBTC', 'Total'],
      ['1 Jan 2024', '100', '200', '300'],
      ['2 Jan 2024', '150', '250', '400'],
      ['3 Jan 2024', '120', '230', '350'],
      ['Total', '370', '680', '1050'],
      ['Minimum', '100', '200', '300'],
      ['Maximum', '150', '250', '400']
    ];
    
    console.log('📊 模拟表格:');
    mockData.forEach((row, i) => {
      console.log(`   ${i}: [${row.join(', ')}]`);
    });
    
    const mockLatest = DataParser.findLatestDate(mockData);
    console.log(`\n🎯 模拟数据定位结果:`);
    if (mockLatest) {
      console.log(`   ✅ 最新日期: ${mockLatest.dateString}`);
      console.log(`   📅 格式化: ${mockLatest.formattedDate}`);
      console.log(`   🎯 方法: ${mockLatest.method}`);
      console.log(`   📍 索引: ${mockLatest.index}`);
    } else {
      console.log(`   ❌ 定位失败`);
    }
    
    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error.message);
  }
}

// 运行测试
testDataParser().catch(console.error); 