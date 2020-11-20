var constants;
// 计算每个节点的加速度。
let calc_acceleration = function(nodes, links) {
    const k_Coulomb = constants.k_Coulomb;
    const k_Hooke = constants.k_Hooke;
    const d_Hooke = constants.d_Hooke;
    const mu = constants.mu;
    // Fx[]和Fy[]分别代表受力在x, y方向的分量
    let Fx = nodes.xs.map(x => 0), Fy = nodes.xs.map(x => 0);
    let xs = nodes.xs, ys = nodes.ys, weights = nodes.weights;
    const len = nodes.xs.length;
    
    // 计算库伦力
    for (let i = 0; i < len; ++i) {
        for (let j = 0; j < i; ++j) {
            let dx = xs[j] - xs[i];
            let dy = ys[j] - ys[i];
            let d = dx * dx + dy * dy;
            let F = k_Coulomb * weights[i] * weights[j] / d;
            Fx[i] += F * dx;
            Fx[j] += -F * dx;
            Fy[i] += F * dy;
            Fy[j] += -F * dy;
        }
    }

    // 计算弹簧弹力
    const len_links = links.length;
    for (let l = 0; l < len_links; ++l) {
        let src = links[l].source;
        let tgt = links[l].target;
        if (src == tgt) continue;
        let dx = xs[src] - xs[tgt];
        let dy = ys[src] - ys[tgt];
        let d = Math.hypot(dx, dy);
        let F = k_Hooke * (d - d_Hooke) * links[l].weight;
        Fx[src] += -F * dx / d;
        Fy[src] += -F * dy / d;
        Fx[tgt] += F * dx / d;
        Fy[tgt] += F * dy / d;
    }
    
    // 计算阻力
    for (let i = 0; i < len; ++i) {
        Fx[i] += mu * nodes.vx[i];
        Fy[i] += mu * nodes.vy[i];
    }

    // 计算加速度
    for (let i = 0; i < len; ++i) {
        Fx[i] /= weights[i];
        Fy[i] /= weights[i];
    }
    return [Fx, Fy];
};

// 需要实现一个图布局算法，给出每个node的x,y属性
onmessage = function(e) {
    let [new_constants, nodes, links] = e.data;
    constants = new_constants;
    const v_threshold = constants.v_threshold;
    const delta_t = constants.delta_t;

    const len = nodes.length;
    // 产生全0数组的便捷函数
    let get_zeros = function() {
        let ret = new Array(len);
        ret.fill(0);
        return ret;
    };

    // nodes的代替品，用来盛放中间结果，OoA = Object of Arrays
    let nodes_OoA = {xs: nodes.map(x => x.x), ys: nodes.map(x => x.y), weights: nodes.map(x => x.weight), vx: get_zeros(), vy: get_zeros()};

    // 收敛时的总动能
    let KE_threshold = nodes_OoA.weights.reduce((a, b) => a + b) * v_threshold * v_threshold;

    let id2idx = {};
    for (let i = 0; i < len; ++i) {
        id2idx[nodes[i].id] = i;
    }
    // links的代替品，把节点的名字换成了它们的编号
    let new_links = links.map(x => { return {source: id2idx[x.source], target: id2idx[x.target], weight: x.weight}; });

    //这是一个随机布局，请在这一部分实现图布局算法
    // Beeman's method
    // a_{t - Δt}的x分量和y分量
    let ax_minus_delta_t = get_zeros(), ay_minus_delta_t = get_zeros();
    // a_t的x分量和y分量
    let [ax, ay] = calc_acceleration(nodes_OoA, new_links);

    while (true) {
        for (let i = 0; i < len; ++i) {
            nodes_OoA.xs[i] += (nodes_OoA.vx[i] + (4 * ax[i] - ax_minus_delta_t[i]) / 6 * delta_t) * delta_t;
            nodes_OoA.ys[i] += (nodes_OoA.vy[i] + (4 * ay[i] - ay_minus_delta_t[i]) / 6 * delta_t) * delta_t;
            nodes_OoA.vx[i] += (3 * ax[i] - ax_minus_delta_t[i]) / 2 * delta_t;
            nodes_OoA.vy[i] += (3 * ay[i] - ay_minus_delta_t[i]) / 2 * delta_t;
        }
        // a_{t + Δt}的x分量和y分量
        let [new_ax, new_ay] = calc_acceleration(nodes_OoA, new_links);
        for (let i = 0; i < len; ++i) {
            nodes_OoA.vx[i] += 5 * (new_ax[i] - 2 * ax[i] + ax_minus_delta_t[i]) * delta_t / 12;
            nodes_OoA.vy[i] += 5 * (new_ay[i] - 2 * ay[i] + ay_minus_delta_t[i]) * delta_t / 12;
        }
        // 计算动能并判断是否需要结束
        //if (calculating) return;
        postMessage([false, nodes_OoA.xs, nodes_OoA.ys]);
        let KE = 0;
        for (let i = 0; i < len; ++i) {
            KE += nodes_OoA.weights[i] * (nodes_OoA.vx[i] * nodes_OoA.vx[i] + nodes_OoA.vy[i] * nodes_OoA.vy[i]);
        }
        if (KE < KE_threshold) break;
        ax_minus_delta_t = ax;
        ay_minus_delta_t = ay;
        ax = new_ax;
        ay = new_ay;
    }

    postMessage([true, nodes_OoA.xs, nodes_OoA.ys]);
    // alert(end - begin);

    // 保存图布局结果和花费时间为json格式，并按提交方式中重命名，提交时请注释这一部分代码
    //var content = JSON.stringify({"time": end-begin, "nodes": nodes, "links": links});
    //var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    //saveAs(blob, "save.json");
}