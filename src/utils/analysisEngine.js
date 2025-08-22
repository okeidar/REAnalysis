/**
 * Analysis Engine for Real Estate Properties
 * Handles all financial calculations and property analysis
 */

class AnalysisEngine {
  constructor() {
    this.MONTHS_PER_YEAR = 12;
    this.DEFAULT_EXPENSES = {
      maintenance: 200,
      vacancy: 150,
      management: 100,
      insurance: 100,
      other: 50
    };
  }

  /**
   * Perform complete property analysis
   * @param {Object} property - Property data
   * @param {Object} userProfile - User preferences and settings
   * @returns {Object} Complete analysis results
   */
  analyzeProperty(property, userProfile) {
    try {
      const analysis = {
        financials: this.calculateFinancials(property, userProfile),
        redFlags: this.identifyRedFlags(property),
        risks: this.assessRisks(property),
        recommendation: '',
        verdict: 'Pass',
        marketInsights: this.generateMarketInsights(property),
        scenarios: this.runScenarios(property, userProfile)
      };

      // Generate recommendation and verdict
      analysis.recommendation = this.generateRecommendation(property, analysis, userProfile);
      analysis.verdict = this.determineVerdict(analysis, userProfile);

      return analysis;
    } catch (error) {
      console.error('Error analyzing property:', error);
      return this.getEmptyAnalysis();
    }
  }

  /**
   * Calculate financial metrics for a property
   * @param {Object} property - Property data
   * @param {Object} userProfile - User preferences
   * @returns {Object} Financial calculations
   */
  calculateFinancials(property, userProfile) {
    const preferences = userProfile.preferences;
    const price = property.price || 0;
    const estimatedRent = property.estimatedRent || this.estimateRent(property);
    
    // Loan calculations
    const downPayment = price * (preferences.downPaymentPercent / 100);
    const loanAmount = price - downPayment;
    const monthlyMortgage = this.calculateMortgage(
      loanAmount,
      preferences.interestRate / 100,
      preferences.loanTerm
    );

    // Monthly expenses
    const monthlyTaxes = (property.taxes || 0) / this.MONTHS_PER_YEAR;
    const monthlyInsurance = preferences.monthlyExpenses.insurance;
    const monthlyMaintenance = preferences.monthlyExpenses.maintenance;
    const monthlyVacancy = preferences.monthlyExpenses.vacancy;
    const monthlyManagement = preferences.monthlyExpenses.management;
    const monthlyOther = preferences.monthlyExpenses.other;

    const totalMonthlyExpenses = monthlyTaxes + monthlyInsurance + 
                                monthlyMaintenance + monthlyVacancy + 
                                monthlyManagement + monthlyOther;

    // Cash flow calculation
    const monthlyCashFlow = estimatedRent - monthlyMortgage - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * this.MONTHS_PER_YEAR;

    // NOI calculation (without mortgage)
    const grossAnnualRent = estimatedRent * this.MONTHS_PER_YEAR;
    const annualOperatingExpenses = totalMonthlyExpenses * this.MONTHS_PER_YEAR - 
                                   (monthlyMortgage * this.MONTHS_PER_YEAR);
    const netOperatingIncome = grossAnnualRent - annualOperatingExpenses;

    // Cap rate calculation
    const capRate = price > 0 ? (netOperatingIncome / price) * 100 : 0;

    // Cash-on-Cash return
    const totalCashInvested = downPayment + (price * 0.03); // Assume 3% closing costs
    const cocReturn = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

    // ROI and other metrics
    const grossRentMultiplier = price > 0 ? price / grossAnnualRent : 0;
    const debtCoverageRatio = monthlyMortgage > 0 ? estimatedRent / monthlyMortgage : 0;

    return {
      purchasePrice: price,
      estimatedRent: estimatedRent,
      downPayment: downPayment,
      loanAmount: loanAmount,
      monthlyMortgage: monthlyMortgage,
      monthlyExpenses: {
        taxes: monthlyTaxes,
        insurance: monthlyInsurance,
        maintenance: monthlyMaintenance,
        vacancy: monthlyVacancy,
        management: monthlyManagement,
        other: monthlyOther,
        total: totalMonthlyExpenses
      },
      cashFlow: {
        monthly: monthlyCashFlow,
        annual: annualCashFlow
      },
      netOperatingIncome: netOperatingIncome,
      capRate: capRate,
      cocReturn: cocReturn,
      totalCashInvested: totalCashInvested,
      grossRentMultiplier: grossRentMultiplier,
      debtCoverageRatio: debtCoverageRatio
    };
  }

  /**
   * Calculate monthly mortgage payment
   * @param {number} principal - Loan amount
   * @param {number} annualRate - Annual interest rate (decimal)
   * @param {number} years - Loan term in years
   * @returns {number} Monthly payment
   */
  calculateMortgage(principal, annualRate, years) {
    if (principal <= 0 || annualRate <= 0 || years <= 0) return 0;
    
    const monthlyRate = annualRate / this.MONTHS_PER_YEAR;
    const numberOfPayments = years * this.MONTHS_PER_YEAR;
    
    const monthlyPayment = principal * 
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    return Math.round(monthlyPayment * 100) / 100;
  }

  /**
   * Estimate rent based on property characteristics
   * @param {Object} property - Property data
   * @returns {number} Estimated monthly rent
   */
  estimateRent(property) {
    // Simple estimation based on price and beds/baths
    // In a real implementation, this would use market data
    const baseRent = (property.price || 0) * 0.001; // 0.1% of price as monthly rent
    const bedroomBonus = (property.beds || 0) * 100;
    const bathroomBonus = (property.baths || 0) * 50;
    const sqftBonus = (property.sqft || 0) * 0.5;
    
    return Math.round(baseRent + bedroomBonus + bathroomBonus + sqftBonus);
  }

  /**
   * Identify potential red flags in the property
   * @param {Object} property - Property data
   * @returns {Array} Array of red flag strings
   */
  identifyRedFlags(property) {
    const redFlags = [];

    // Price-related red flags
    if (property.price > 1000000) {
      redFlags.push("High purchase price may limit cash flow potential");
    }
    
    if (property.pricePerSqft > 200) {
      redFlags.push("Price per square foot is above market average");
    }

    // Property condition red flags
    if (property.yearBuilt && property.yearBuilt < 1980) {
      redFlags.push("Older property may require significant maintenance");
    }

    if (property.description) {
      const desc = property.description.toLowerCase();
      if (desc.includes('fixer') || desc.includes('tlc') || desc.includes('handyman')) {
        redFlags.push("Property may require immediate repairs or renovation");
      }
      if (desc.includes('flood') || desc.includes('water damage')) {
        redFlags.push("Potential water damage or flood risk");
      }
      if (desc.includes('foundation') || desc.includes('structural')) {
        redFlags.push("Possible structural issues mentioned");
      }
    }

    // Tax-related red flags
    if (property.taxes > property.price * 0.03) {
      redFlags.push("High property taxes relative to purchase price");
    }

    // Market red flags
    if (property.daysOnMarket > 90) {
      redFlags.push("Property has been on market for extended period");
    }

    return redFlags;
  }

  /**
   * Assess various risks associated with the property
   * @param {Object} property - Property data
   * @returns {Array} Array of risk assessment strings
   */
  assessRisks(property) {
    const risks = [];

    // Location risks
    if (property.address) {
      // This would integrate with crime/safety APIs in a real implementation
      risks.push("Consider researching neighborhood crime rates and safety");
    }

    // Market risks
    risks.push("Interest rate changes could affect refinancing options");
    risks.push("Local market conditions may impact property values");

    // Property-specific risks
    if (property.sqft < 1000) {
      risks.push("Smaller properties may have limited tenant appeal");
    }

    if (property.beds < 2) {
      risks.push("Single bedroom properties may have higher vacancy rates");
    }

    return risks;
  }

  /**
   * Generate market insights for the property location
   * @param {Object} property - Property data
   * @returns {Object} Market insights
   */
  generateMarketInsights(property) {
    // In a real implementation, this would integrate with market data APIs
    return {
      averageRent: this.estimateRent(property),
      vacancyRate: 5.2, // National average
      rentTrends: "Stable",
      jobGrowth: "Moderate",
      populationGrowth: "Steady",
      marketRisk: "Medium"
    };
  }

  /**
   * Run different investment scenarios
   * @param {Object} property - Property data
   * @param {Object} userProfile - User preferences
   * @returns {Object} Scenario analysis
   */
  runScenarios(property, userProfile) {
    const baseAnalysis = this.calculateFinancials(property, userProfile);
    
    // Interest rate scenarios
    const rateIncrease = { ...userProfile };
    rateIncrease.preferences.interestRate += 1;
    const higherRateAnalysis = this.calculateFinancials(property, rateIncrease);

    // Rent increase scenario
    const rentIncrease = { ...property };
    rentIncrease.estimatedRent = (rentIncrease.estimatedRent || this.estimateRent(property)) * 1.1;
    const higherRentAnalysis = this.calculateFinancials(rentIncrease, userProfile);

    return {
      base: baseAnalysis,
      interestRateIncrease: higherRateAnalysis,
      rentIncrease: higherRentAnalysis
    };
  }

  /**
   * Generate a comprehensive recommendation
   * @param {Object} property - Property data
   * @param {Object} analysis - Analysis results
   * @param {Object} userProfile - User preferences
   * @returns {string} Recommendation text
   */
  generateRecommendation(property, analysis, userProfile) {
    const financials = analysis.financials;
    const preferences = userProfile.preferences;
    
    let recommendation = "";

    // Cash flow assessment
    if (financials.cashFlow.monthly >= preferences.targetCashFlow) {
      recommendation += `✅ Strong cash flow of $${financials.cashFlow.monthly}/month meets your target. `;
    } else {
      recommendation += `❌ Monthly cash flow of $${financials.cashFlow.monthly} falls short of your $${preferences.targetCashFlow} target. `;
    }

    // Cap rate assessment
    if (financials.capRate >= preferences.targetCapRate) {
      recommendation += `✅ Cap rate of ${financials.capRate.toFixed(2)}% meets your target. `;
    } else {
      recommendation += `❌ Cap rate of ${financials.capRate.toFixed(2)}% is below your ${preferences.targetCapRate}% target. `;
    }

    // CoC return assessment
    if (financials.cocReturn >= preferences.targetCoCReturn) {
      recommendation += `✅ Cash-on-cash return of ${financials.cocReturn.toFixed(2)}% exceeds your target. `;
    } else {
      recommendation += `❌ Cash-on-cash return of ${financials.cocReturn.toFixed(2)}% is below your ${preferences.targetCoCReturn}% target. `;
    }

    // Red flags consideration
    if (analysis.redFlags.length > 0) {
      recommendation += `⚠️ Consider ${analysis.redFlags.length} identified red flags before proceeding. `;
    }

    return recommendation.trim();
  }

  /**
   * Determine overall verdict for the property
   * @param {Object} analysis - Analysis results
   * @param {Object} userProfile - User preferences
   * @returns {string} Verdict (Strong Buy, Worth Considering, Pass)
   */
  determineVerdict(analysis, userProfile) {
    const financials = analysis.financials;
    const preferences = userProfile.preferences;
    
    let score = 0;
    
    // Scoring based on meeting targets
    if (financials.cashFlow.monthly >= preferences.targetCashFlow) score += 3;
    else if (financials.cashFlow.monthly >= preferences.targetCashFlow * 0.8) score += 2;
    else if (financials.cashFlow.monthly >= 0) score += 1;
    
    if (financials.capRate >= preferences.targetCapRate) score += 3;
    else if (financials.capRate >= preferences.targetCapRate * 0.8) score += 2;
    else if (financials.capRate >= 4) score += 1;
    
    if (financials.cocReturn >= preferences.targetCoCReturn) score += 3;
    else if (financials.cocReturn >= preferences.targetCoCReturn * 0.8) score += 2;
    else if (financials.cocReturn >= 8) score += 1;

    // Deduct points for red flags
    score -= analysis.redFlags.length;

    // Determine verdict based on score
    if (score >= 7) return "Strong Buy";
    if (score >= 4) return "Worth Considering";
    return "Pass";
  }

  /**
   * Compare multiple properties
   * @param {Array} properties - Array of property objects with analysis
   * @returns {Array} Sorted properties with comparison data
   */
  compareProperties(properties) {
    return properties
      .map(property => ({
        ...property,
        comparisonScore: this.calculateComparisonScore(property.analysis)
      }))
      .sort((a, b) => b.comparisonScore - a.comparisonScore);
  }

  /**
   * Calculate a comparison score for ranking properties
   * @param {Object} analysis - Property analysis
   * @returns {number} Comparison score
   */
  calculateComparisonScore(analysis) {
    if (!analysis || !analysis.financials) return 0;
    
    const financials = analysis.financials;
    let score = 0;
    
    // Weight different metrics
    score += financials.cashFlow.monthly * 0.4;
    score += financials.capRate * 10;
    score += financials.cocReturn * 5;
    
    // Penalty for red flags
    if (analysis.redFlags) {
      score -= analysis.redFlags.length * 50;
    }
    
    return Math.max(0, score);
  }

  /**
   * Get empty analysis object for error cases
   * @returns {Object} Empty analysis structure
   */
  getEmptyAnalysis() {
    return {
      financials: {
        purchasePrice: 0,
        estimatedRent: 0,
        cashFlow: { monthly: 0, annual: 0 },
        capRate: 0,
        cocReturn: 0
      },
      redFlags: [],
      risks: [],
      recommendation: "Unable to analyze property",
      verdict: "Pass",
      marketInsights: {},
      scenarios: {}
    };
  }
}

// Note: Instance will be created in background script for service worker compatibility
