;(async utils => {
  const {fetchData, render, renderEnvironment, getHistogramData, getAverageValue, getPValue} = utils

  function renderWithBatches(batchIdA, batchIdB) {
    const graphs = [
      [
        'runtime-histogram',
        () =>
          getHistogramData('timing-total', {where: o => o.batchId === batchIdA}).concat(
            getHistogramData('timing-total', {where: o => o.batchId === batchIdB}),
          ),
        {
          title: `Runtime Distribution`,
          xaxis: {ticksuffix: ' s'},
        },
      ],
      [
        'tti-histogram',
        () =>
          getHistogramData('interactive-deltasPercent', {
            where: o => o.batchId === batchIdA,
          }).concat(
            getHistogramData('interactive-deltasPercent', {where: o => o.batchId === batchIdB}),
          ),
        {
          title: `TTI Deltas Distribution`,
          xaxis: {ticksuffix: ' %'},
        },
      ],
    ]

    const tiles = [
      [
        'runtime-avg-a',
        () => getAverageValue('timing-total', {where: o => o.batchId === batchIdA}),
        {title: 'Avg Runtime A', unit: 's'},
      ],
      [
        'runtime-avg-b',
        () => getAverageValue('timing-total', {where: o => o.batchId === batchIdB}),
        {title: 'Avg Runtime B', unit: 's'},
      ],
      [
        'runtime-avg-pvalue',
        () =>
          getPValue('timing-total', {
            whereA: o => o.batchId === batchIdA,
            whereB: o => o.batchId === batchIdB,
          }),
        {title: 'P-Value', unit: '%'},
      ],
      [
        'tti-avg-a',
        () => getAverageValue('interactive-deltasPercent', {where: o => o.batchId === batchIdA}),
        {title: 'Avg TTI Delta A', unit: '%'},
      ],
      [
        'tti-avg-b',
        () => getAverageValue('interactive-deltasPercent', {where: o => o.batchId === batchIdB}),
        {title: 'Avg TTI Delta B', unit: '%'},
      ],
      [
        'tti-avg-pvalue',
        () =>
          getPValue('interactive-deltasPercent', {
            whereA: o => o.batchId === batchIdA,
            whereB: o => o.batchId === batchIdB,
          }),
        {title: 'P-Value', unit: '%'},
      ],
    ]

    render({graphs, tiles})
    renderEnvironment({id: 'environment-a', batchId: batchIdA})
    renderEnvironment({id: 'environment-b', batchId: batchIdB})
  }

  const {sortedBatchIds} = await fetchData()
  let batchIdA = sortedBatchIds[sortedBatchIds.length - 1]
  let batchIdB = sortedBatchIds[sortedBatchIds.length - 2]
  renderWithBatches(batchIdA, batchIdB)
})(window.utils)
