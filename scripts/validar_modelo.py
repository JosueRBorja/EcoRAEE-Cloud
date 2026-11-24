import json
from pathlib import Path
from backend.app.flujo import maximum_flow

ROOT = Path(__file__).resolve().parents[1]


def main():
    dataset = json.loads((ROOT/'math/manual-network.json').read_text(encoding='utf-8'))
    results = []
    for factor in (1, 2, 3):
        edges = [{**e,'capacity':e['capacity']*factor} for e in dataset['edges']]
        result = maximum_flow(dataset['nodes'],edges,dataset['source'],dataset['sink'])
        assert result['max_flow'] == result['cut_capacity'] == dataset['expected_max_flow']*factor
        for node in dataset['nodes']:
            if node['id'] not in (dataset['source'],dataset['sink']):
                assert sum(e['flow'] for e in result['edges'] if e['target_id']==node['id']) == sum(e['flow'] for e in result['edges'] if e['source_id']==node['id'])
        results.append({'factor':factor,**result})
    output = ROOT/'evidence/math-scenarios.json'
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(output)


if __name__ == '__main__': main()
