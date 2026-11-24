"""Edmonds-Karp: capacidades enteras, aristas antiparalelas y certificado de corte mínimo."""
from collections import deque


def maximum_flow(nodes, edges, source, sink):
    ids = {n['id'] for n in nodes}
    if source not in ids or sink not in ids or source == sink:
        raise ValueError('Selecciona un origen y un destino diferentes que existan en la red.')
    graph = {node: [] for node in ids}
    forward = []
    for edge in edges:
        u, v, capacity = edge['source_id'], edge['target_id'], edge['capacity']
        if u not in ids or v not in ids or u == v or type(capacity) is not int or capacity < 0:
            raise ValueError('La red contiene una arista inválida.')
        a = {'to': v, 'residual': capacity, 'reverse': len(graph[v])}
        b = {'to': u, 'residual': 0, 'reverse': len(graph[u])}
        graph[u].append(a); graph[v].append(b)
        forward.append((edge, a))
    total = 0
    while True:
        parent = {source: None}
        queue = deque([source])
        while queue and sink not in parent:
            u = queue.popleft()
            for i, edge in enumerate(graph[u]):
                if edge['residual'] > 0 and edge['to'] not in parent:
                    parent[edge['to']] = (u, i)
                    queue.append(edge['to'])
        if sink not in parent:
            reachable = set(parent)
            break
        delta, v = float('inf'), sink
        while v != source:
            u, i = parent[v]; delta = min(delta, graph[u][i]['residual']); v = u
        v = sink
        while v != source:
            u, i = parent[v]; edge = graph[u][i]
            edge['residual'] -= delta
            graph[v][edge['reverse']]['residual'] += delta
            v = u
        total += delta
    result = [{**e, 'flow': e['capacity'] - link['residual'], 'saturated': e['capacity'] > 0 and link['residual'] == 0} for e, link in forward]
    cut = [e['id'] for e in edges if e['source_id'] in reachable and e['target_id'] not in reachable]
    cut_capacity = sum(e['capacity'] for e in edges if e['id'] in cut)
    return {'max_flow': total, 'cut_capacity': cut_capacity, 'min_cut_edges': cut, 'source_partition': sorted(reachable), 'sink_partition': sorted(ids - reachable), 'edges': result}
