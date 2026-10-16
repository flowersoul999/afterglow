---
title: Java动态代理
published: 2026-03-11
tags:
  - java
description: 嘿，你有没有试过在不碰原代码的前提下，悄悄给方法加点日志、事务或者权限校验？Java 动态代理就是干这个的——它不改一行业务逻辑，却能让你在方法“前后”自由插队。今天咱们就轻松聊聊 JDK 代理和 CGLIB 的区别、怎么用、以及踩过哪些坑 🌟
descriptionSource: ai
---
## 一、动态代理核心概念

### 1.1 什么是代理模式？
```
代理模式 = 代理对象 + 目标对象
```
- **代理对象**：不直接实现服务，而是通过调用目标对象的方法来提供服务
- **目标对象**：真正执行业务逻辑的对象
- **核心价值**：在不修改目标对象代码的前提下，增强或控制目标对象的行为

### 1.2 静态代理 vs 动态代理

| 对比项 | 静态代理 | 动态代理 |
|--------|----------|----------|
| 创建时间 | 编译期 | 运行期 |
| 代码生成 | 手动编写或工具生成 | 反射机制动态生成 |
| 灵活性 | 低（每个类需单独代理） | 高（可统一处理多个类） |
| .class文件 | 运行前已存在 | 运行时生成 |

---

## 二、JDK动态代理（基于接口）

### 2.1 核心类与接口

```java
// 1. InvocationHandler接口（必须实现）
public interface InvocationHandler {
    Object invoke(Object proxy, Method method, Object[] args) throws Throwable;
}

// 2. Proxy类（用于创建代理对象）
public static Object newProxyInstance(
    ClassLoader loader,      // 类加载器
    Class<?>[] interfaces,   // 目标对象实现的接口
    InvocationHandler h      // 调用处理器
)
```

### 2.2 实现步骤

```
┌─────────────────────────────────────────────────┐
│  步骤1: 定义接口                                  │
│  步骤2: 创建目标类实现接口                        │
│  步骤3: 创建InvocationHandler实现类              │
│  步骤4: 通过Proxy创建代理对象                    │
│  步骤5: 调用代理对象方法                         │
└─────────────────────────────────────────────────┘
```

### 2.3 代码示例

```java
// ① 定义接口
public interface UserService {
    void addUser(String name);
    void deleteUser(String id);
}

// ② 目标类实现接口
public class UserServiceImpl implements UserService {
    @Override
    public void addUser(String name) {
        System.out.println("添加用户: " + name);
    }
    @Override
    public void deleteUser(String id) {
        System.out.println("删除用户: " + id);
    }
}

// ③ 创建InvocationHandler
public class UserServiceProxy implements InvocationHandler {
    private Object target; // 目标对象
    
    public UserServiceProxy(Object target) {
        this.target = target;
    }
    
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        // 前置增强
        System.out.println("=== 方法执行前：日志记录 ===");
        
        // 执行目标方法
        Object result = method.invoke(target, args);
        
        // 后置增强
        System.out.println("=== 方法执行后：事务提交 ===");
        
        return result;
    }
}

// ④ 测试类
public class Test {
    public static void main(String[] args) {
        UserService target = new UserServiceImpl();
        
        // 创建代理对象
        UserService proxy = (UserService) Proxy.newProxyInstance(
            target.getClass().getClassLoader(),
            target.getClass().getInterfaces(),
            new UserServiceProxy(target)
        );
        
        // 调用代理方法
        proxy.addUser("张三");
        proxy.deleteUser("001");
    }
}
```

### 2.4 JDK动态代理特点

| 优点 | 缺点 |
|------|------|
| ✅ JDK原生支持，无需额外依赖 | ❌ 只能代理接口 |
| ✅ 启动速度快 | ❌ 无法代理未实现接口的类 |
| ✅ 代码简洁易理解 | ❌ 无法代理final方法 |

---

## 三、CGLIB动态代理（基于继承）

### 3.1 核心原理
- 通过**生成目标类的子类**来实现代理
- 使用**MethodInterceptor**拦截方法调用
- 需要引入CGLIB依赖

### 3.2 Maven依赖
```xml
<dependency>
    <groupId>cglib</groupId>
    <artifactId>cglib</artifactId>
    <version>3.3.0</version>
</dependency>
```

### 3.3 代码示例

```java
// ① 目标类（无需实现接口）
public class UserService {
    public void addUser(String name) {
        System.out.println("添加用户: " + name);
    }
    
    public void deleteUser(String id) {
        System.out.println("删除用户: " + id);
    }
}

// ② 创建MethodInterceptor
public class CglibProxy implements MethodInterceptor {
    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        // 前置增强
        System.out.println("=== CGLIB前置增强 ===");
        
        // 执行目标方法
        Object result = proxy.invokeSuper(obj, args);
        
        // 后置增强
        System.out.println("=== CGLIB后置增强 ===");
        
        return result;
    }
}

// ③ 创建代理对象
public class Test {
    public static void main(String[] args) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(UserService.class);
        enhancer.setCallback(new CglibProxy());
        
        UserService proxy = (UserService) enhancer.create();
        proxy.addUser("李四");
    }
}
```

### 3.4 CGLIB动态代理特点

| 优点 | 缺点 |
|------|------|
| ✅ 可代理普通类（无需接口） | ❌ 需要额外依赖 |
| ✅ 功能更强大 | ❌ 无法代理final类/方法 |
| ✅ 适合第三方类代理 | ❌ 启动速度较慢 |

---

## 四、JDK vs CGLIB 对比总结

```
┌──────────────────┬──────────────────┬──────────────────┐
│      对比项       │   JDK动态代理     │    CGLIB动态代理   │
├──────────────────┼──────────────────┼──────────────────┤
│    实现方式       │     基于接口       │     基于继承       │
│    核心类         │  Proxy+InvocationHandler │  Enhancer+MethodInterceptor │
│    是否需要接口    │        是         │        否         │
│    额外依赖       │        无         │       需要        │
│    代理final方法  │        不能       │        不能       │
│    性能           │    JDK8+后优化    │     略低于JDK     │
│    Spring默认选择  │  有接口用JDK       │  无接口用CGLIB    │
└──────────────────┴──────────────────┴──────────────────┘
```

---

## 五、实际应用场景

### 5.1 Spring AOP
```java
// Spring根据目标类是否有接口自动选择代理方式
// 有接口 → JDK动态代理
// 无接口 → CGLIB动态代理

@Transactional  // 事务管理
@Cacheable      // 缓存管理
@Async          // 异步执行
```

### 5.2 常见应用场景
1. **日志记录** - 统一记录方法调用日志
2. **权限校验** - 方法执行前检查用户权限
3. **事务管理** - 自动开启/提交/回滚事务
4. **性能监控** - 统计方法执行时间
5. **RPC框架** - Dubbo、Feign等远程调用

---

## 六、学习要点总结

```
📌 核心记忆点：
1. 动态代理 = 运行时生成代理类
2. JDK代理 → 接口 + Proxy + InvocationHandler
3. CGLIB代理 → 继承 + Enhancer + MethodInterceptor
4. Spring AOP自动选择代理方式
5. final类/方法都无法被代理

📌 面试常考点：
1. JDK和CGLIB的区别
2. 动态代理的实现原理
3. Spring AOP底层实现
4. 代理模式的应用场景
```

---

## 七、练习题建议

1. 手写一个JDK动态代理实现日志功能
2. 手写一个CGLIB动态代理实现权限校验
3. 对比两种代理方式的性能差异
4. 分析Spring AOP的代理选择逻辑

---

> 💡 **学习建议**：动态代理是Java进阶的必备知识，建议多动手敲代码理解原理，结合Spring AOP一起学习效果更好！

希望这份笔记对您学习Java动态代理有帮助！如需更详细的内容，建议配合B站相关视频教程一起学习。